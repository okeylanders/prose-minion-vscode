/*
 * The page probes of the Slice 4M visual harness (harness.js), kept apart so
 * the harness stays a readable size. Each runs in the page (`tab.evaluate`).
 *
 * The rule the hover checks hold the board to (Slice 4M): hovering changes
 * paint only, never layout. Nothing in the ribbon's top area may change size
 * between hover and unhover, the hovered element may not move, and the focus
 * line may not flicker while the pointer holds still.
 */

/**
 * A point the pointer can rest on that hovers nothing: not on any control,
 * not on the ribbon. Tried down the window's left and right edges.
 */
function neutralPoint() {
  const interactive = 'button, a, input, select, textarea, label, [role="button"], [tabindex], .pm-lb-ribbon';
  for (const x of [3, window.innerWidth - 3, Math.round(window.innerWidth / 2)]) {
    for (let y = 3; y < window.innerHeight; y += 17) {
      const element = document.elementFromPoint(x, y);
      if (element && !element.closest(interactive)) {
        return { x, y };
      }
    }
  }
  return { x: 1, y: 1 };
}

/** The boxes the hover check compares, rounded to a hundredth of a pixel. */
function boxes(targetSelector) {
  const round = (rect) => rect && ({
    x: Math.round(rect.x * 100) / 100,
    y: Math.round(rect.y * 100) / 100,
    width: Math.round(rect.width * 100) / 100,
    height: Math.round(rect.height * 100) / 100
  });
  const box = (selector) => {
    const element = document.querySelector(selector);
    return element ? round(element.getBoundingClientRect()) : null;
  };
  const target = document.querySelector(targetSelector);
  const focus = document.querySelector('.pm-lb-ribbon-focus');
  return {
    ribbon: box('.pm-lb-ribbon'),
    top: box('.pm-lb-ribbon-top'),
    focusLine: focus ? round(focus.getBoundingClientRect()) : null,
    target: target ? round(target.getBoundingClientRect()) : null,
    focusText: focus ? focus.textContent.replace(/\s+/g, ' ').trim() : null,
    // The text's own box, when it is wider than the line shows: the clipping at work.
    focusClipped: (() => {
      const text = document.querySelector('.pm-lb-ribbon-focus-text') || focus;
      return text ? text.scrollWidth > text.clientWidth + 1 : false;
    })(),
    hot: target ? target.classList.contains('is-hot') : false
  };
}

/**
 * Watch the ribbon while the pointer holds still: every change of the focus
 * line's text, and the ribbon's height on every frame. Read it with `stopWatch`.
 */
function startWatch() {
  const focusText = () => (document.querySelector('.pm-lb-ribbon-focus')?.textContent ?? '').replace(/\s+/g, ' ').trim();
  const ribbon = document.querySelector('.pm-lb-ribbon');
  const watch = { texts: [focusText()], heights: [], running: true };
  watch.observer = new MutationObserver(() => {
    const text = focusText();
    if (text !== watch.texts[watch.texts.length - 1]) {
      watch.texts.push(text);
    }
  });
  watch.observer.observe(document.querySelector('.pm-lb-ribbon-top') || document.body, { subtree: true, childList: true, characterData: true });
  const frame = () => {
    if (!watch.running) { return; }
    const height = Math.round((ribbon?.getBoundingClientRect().height ?? 0) * 100) / 100;
    if (watch.heights.length === 0 || watch.heights[watch.heights.length - 1] !== height) {
      watch.heights.push(height);
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  window.__pmWatch = watch;
}

function stopWatch() {
  const watch = window.__pmWatch;
  watch.running = false;
  watch.observer.disconnect();
  return { changes: watch.texts.length - 1, texts: watch.texts.slice(0, 12), heights: watch.heights.slice(0, 24), heightChanges: watch.heights.length - 1 };
}

/*
 * The layout is every element's box under the Lightbox surface but what is
 * inside the focus line, whose words change on hover by design (the line's
 * own box is kept, and must not move). Each probe below runs alone in the
 * page, so each lists the elements itself.
 */

/** Every layout element's box, as one string: the layout, whatever paints. */
function layoutSignature() {
  const root = document.querySelector('[data-pm-surface="lightbox"]');
  const parts = [];
  for (const element of root.querySelectorAll('*')) {
    if (element.parentElement.closest('.pm-lb-ribbon-focus')) { continue; }
    const rect = element.getBoundingClientRect();
    parts.push(`${Math.round(rect.x * 4)},${Math.round(rect.y * 4)},${Math.round(rect.width * 4)},${Math.round(rect.height * 4)}`);
  }
  return parts.join(';');
}

/** The first few elements whose box differs between two signatures, named. */
function layoutDifference({ before, after }) {
  const root = document.querySelector('[data-pm-surface="lightbox"]');
  const elements = [...root.querySelectorAll('*')].filter((element) => !element.parentElement.closest('.pm-lb-ribbon-focus'));
  const a = before.split(';');
  const b = after.split(';');
  const changed = [];
  if (a.length !== b.length) {
    return { count: Math.abs(a.length - b.length), first: [`element count ${a.length} → ${b.length}`] };
  }
  for (let index = 0; index < a.length; index++) {
    if (a[index] !== b[index]) {
      changed.push(index);
    }
  }
  const name = (element) => `${element.tagName.toLowerCase()}${element.className && typeof element.className === 'string' ? `.${element.className.trim().split(/\s+/).join('.')}` : ''}`;
  return { count: changed.length, first: changed.slice(0, 4).map((index) => `${name(elements[index])} ${a[index]} → ${b[index]}`) };
}

/** Every control in the board's column, each tagged so the harness can find it again, in document order. */
function tagControls() {
  const scroll = document.querySelector('.pm-lb-scroll');
  const controls = [...scroll.querySelectorAll('button')].filter((button) => {
    const rect = button.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  });
  controls.forEach((button, index) => button.setAttribute('data-pm-audit', String(index)));
  return controls.map((button) => (button.getAttribute('aria-label') || button.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60));
}

/** Bring one tagged control to the middle of its scroller, and say where its middle is. */
function showControl(index) {
  const button = document.querySelector(`[data-pm-audit="${index}"]`);
  if (!button) { return null; }
  button.scrollIntoView({ block: 'center', inline: 'nearest' });
  document.scrollingElement.scrollLeft = 0;
  const rect = button.getBoundingClientRect();
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;
  // A control under the sticky ribbon, or off screen, cannot be hovered here: skipped, and counted.
  const hit = document.elementFromPoint(x, y);
  return hit && (hit === button || button.contains(hit)) ? { x, y } : null;
}

/** The run line's presses, as drawn: label, cost, style, state, name and description, and whether each fits. */
function runLineFacts() {
  const clean = (value) => (value ?? '').replace(/\s+/g, ' ').trim();
  const toolbar = document.querySelector('.pm-lb-toolbar');
  const box = toolbar?.getBoundingClientRect();
  const press = (button) => button && ({
    text: clean(button.textContent),
    cost: clean(button.querySelector('.pm-lb-run-cost')?.textContent),
    className: button.className,
    icon: button.querySelector('svg') ? true : false,
    disabled: button.disabled,
    describedBy: button.getAttribute('aria-describedby'),
    description: clean(document.getElementById(button.getAttribute('aria-describedby') ?? '')?.textContent),
    title: button.getAttribute('title'),
    inToolbar: box ? (() => {
      const rect = button.getBoundingClientRect();
      return rect.left >= box.left - 0.5 && rect.right <= box.right + 0.5;
    })() : false,
    height: Math.round(button.getBoundingClientRect().height)
  });
  const primary = document.querySelector('.pm-lb-run-press');
  const secondary = document.querySelector('.pm-lb-run-secondary');
  const escaped = [];
  if (toolbar) {
    const walker = document.createTreeWalker(toolbar, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (node.textContent.trim() === '') { continue; }
      const range = document.createRange();
      range.selectNodeContents(node);
      if ([...range.getClientRects()].some((rect) => rect.width > 0 && rect.right > box.right + 0.5)) {
        escaped.push(clean(node.textContent).slice(0, 40));
      }
    }
  }
  // Side by side: on one row whenever the run line is wide enough for both.
  const run = document.querySelector('.pm-lb-run')?.getBoundingClientRect();
  const sideBySide = primary && secondary ? (() => {
    const a = primary.getBoundingClientRect();
    const b = secondary.getBoundingClientRect();
    const sameRow = a.top < b.bottom && b.top < a.bottom && b.left >= a.right;
    const roomForBoth = run ? a.width + b.width + 10 <= run.width + 0.5 : false;
    return { sameRow, roomForBoth };
  })() : null;
  return {
    note: clean(document.querySelector('.pm-lb-run-note')?.textContent),
    primary: press(primary),
    secondary: press(secondary),
    besidePrimary: Boolean(primary && secondary && primary.nextElementSibling === secondary),
    sideBySide,
    reasons: [...document.querySelectorAll('.pm-lb-run .pm-lb-run-reason')].map((reason) => ({ id: reason.id, text: clean(reason.textContent) })),
    escaped,
    horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth
  };
}

module.exports = { neutralPoint, boxes, startWatch, stopWatch, layoutSignature, layoutDifference, tagControls, showControl, runLineFacts };
