/* =========================================================================
   Prose Minion — Direction B (Split & Pinned) — interactive prototype logic
   Depends on: icons.js (ICONS)
   ========================================================================= */

const EXCERPT = `"Ya."

"Yep."

Ava shook her head and rendered Raven a wink. The group pressed toward the door with Micah at the front.`;

const CONTEXT_CHIPS = ['CLAUDE.md', 'chapter-5.7.md', 'Micah/voice-guide.md', 'Ava/character.md', 'Raven/voice-guide.md'];

/* ---- Tool definitions: analysis + per-tool quick actions + variations ---- */
const ASSIST = {
  dialogue: {
    label: 'Dialogue & Beats', icon: 'dialogue',
    analysis: [
      { icon: 'dialogue', h: 'Beat Cadence', p: `The clipped "Ya." / "Yep." earns its terseness — but two bare monosyllables back-to-back flatten the rhythm right before a group exit. Let one speaker answer with a <em>gesture</em> instead of a word so the beat breathes.` },
      { icon: 'hand', h: 'Microbeats', p: `"shook her head <em>and</em> rendered Raven a wink" stacks two head actions in one clause. Pick the one carrying subtext — the wink is doing the work; the head-shake is noise.` },
      { icon: 'move', h: 'Hand-off to Action', p: `"pressed toward the door with Micah at the front" reads clearly, but "pressed toward" softens the momentum you've built. A harder verb lands the group's urgency.` },
    ],
    actions: ['Generate 3 tighter variations', 'Add a gesture beat', 'Show & Tell pass', 'Flag clichés', 'Keep as-is'],
    variations: [
      ['Tighter', `Ava caught Raven's eye and winked. They moved for the door, Micah breaking the lead.`],
      ['With a gesture beat', `"Ya." Raven's mouth twitched. Ava answered the almost-smile with a wink, and the group spilled toward the door behind Micah.`],
      ['Higher momentum', `The wink was the whole goodbye. Then they were moving — Micah first, the rest of them crowding the door.`],
    ],
  },
  prose: {
    label: 'Prose', icon: 'pen',
    analysis: [
      { icon: 'pen', h: 'Verb Economy', p: `"rendered Raven a wink" is ornate for a small beat — "rendered" pulls a reader's eye to the prose instead of the moment. Plain "winked at Raven" keeps the camera on the characters.` },
      { icon: 'wave', h: 'Sentence Rhythm', p: `Three short fragments then one long compound sentence — the cadence is good, but the final sentence carries two ideas (the wink, the exit). Splitting them gives the exit its own beat.` },
    ],
    actions: ['Rewrite for flow', 'Strengthen the verbs', '3 line-level variations', 'Tighten by 20%', 'Keep as-is'],
    variations: [
      ['Flow', `Ava shook her head, then winked at Raven. The group pressed for the door, Micah at the front.`],
      ['Stronger verbs', `Ava shook her head and shot Raven a wink. The group surged toward the door, Micah leading.`],
      ['Tightened', `Ava winked at Raven. The group made for the door, Micah first.`],
    ],
  },
  gestures: {
    label: 'Gestures', icon: 'hand',
    analysis: [
      { icon: 'hand', h: 'Gesture Inventory', p: `Two gestures in two sentences: a head-shake and a wink, both from Ava, both face/head. The passage reads "busy" above the neck while the rest of the body stays static.` },
      { icon: 'repeat', h: 'Repetition Risk', p: `Ava winked three pages ago (chapter-5.7). A second wink this close reads as a tic rather than character. Consider giving Raven the return beat instead.` },
    ],
    actions: ['Vary the gesture', 'Make it subtler', 'Tie to voice guide', '3 variations', 'Keep as-is'],
    variations: [
      ['Subtler', `Ava tipped her chin at Raven — half a smile, gone before it landed.`],
      ['Body, not face', `Ava bumped Raven's shoulder on the way past, the closest she came to goodbye.`],
      ['Returned beat', `Ava shook her head. Raven caught it and winked back, and the group pressed for the door.`],
    ],
  },
  choreography: {
    label: 'Choreography', icon: 'move',
    analysis: [
      { icon: 'move', h: 'Blocking', p: `The group moves "toward the door with Micah at the front." Clear enough — but we never placed Micah in the scene before now, so he teleports to the lead. One earlier anchor fixes the jump.` },
      { icon: 'target', h: 'Spatial Logic', p: `If Ava is facing Raven to wink, she's turned away from the door. The group "pressing" past her implies she pivots — worth one half-beat so the motion doesn't snap.` },
    ],
    actions: ['Map the blocking', 'Fix the spatial jump', 'Slow the motion down', '3 variations', 'Keep as-is'],
    variations: [
      ['Anchored Micah', `Micah was already by the door. Ava winked at Raven, then turned and followed the others into his wake.`],
      ['Smoothed pivot', `Ava winked at Raven, then let the current of the group turn her toward the door, Micah at the front.`],
      ['Slowed', `Ava held Raven's eye a beat — the wink — before the press of the others carried her around toward the door, Micah leading them out.`],
    ],
  },
  cliche: {
    label: 'Cliché', icon: 'stamp',
    analysis: [
      { icon: 'stamp', h: 'Flagged Phrasings', p: `Nothing egregious here. "shook her head" is the closest to stock — it's invisible from overuse rather than cliché. "rendered a wink" actually over-corrects in the other direction (purple).` },
      { icon: 'sprout', h: 'Fresh Alternative', p: `The instinct to avoid "winked" is right; the fix isn't a fancier verb, it's a more specific image. What does Ava's particular wink look like?` },
    ],
    actions: ['Replace each flag', 'Suggest fresh images', 'Show only flagged lines', 'Keep voice intact', 'Keep as-is'],
    variations: [
      ['Specific image', `Ava shut one eye at Raven — the slow, deliberate wink she saved for trouble.`],
      ['Cut the head-shake', `Ava winked at Raven and said nothing, which from Ava meant yes.`],
      ['Plainer', `Ava gave Raven a wink. The group pressed for the door, Micah at the front.`],
    ],
  },
  repetition: {
    label: 'Repetition', icon: 'repeat',
    analysis: [
      { icon: 'repeat', h: 'Echoes in Passage', p: `"the" appears 3× in the final sentence ("the group… the door… the front"). Below your usual threshold, but the triple gives the exit a list-like flatness.` },
      { icon: 'list', h: 'Cross-Chapter', p: `"shook her head" appears 4× in chapters 5.7–5.8. It's becoming an Ava default. Worth varying at least one.` },
    ],
    actions: ['List all echoes', 'Rewrite to vary', 'Keep intentional repeats', '3 variations', 'Keep as-is'],
    variations: [
      ['De-listed', `Ava winked at Raven. Micah was already pulling the group toward the door.`],
      ['Varied gesture', `Ava rolled her eyes at Raven — fond — and the group pressed for the door, Micah at the front.`],
      ['Compressed', `Ava winked. The group followed Micah to the door.`],
    ],
  },
  showtell: {
    label: 'Show & Tell', icon: 'eye',
    analysis: [
      { icon: 'eye', h: 'Telling vs. Showing', p: `"shook her head" summarizes a reaction we'd feel more if we saw what prompted it. It's a small tell — fine in a transition beat, but you could earn more from it.` },
      { icon: 'target', h: 'Where to Dramatize', p: `The wink is shown (good). The group's mood as they leave is neither shown nor told — a half-line of how the room feels on the way out would close the scene with sensation.` },
    ],
    actions: ['Dramatize the summary', 'Find more tell', 'Balance the ratio', '3 variations', 'Keep as-is'],
    variations: [
      ['Shown reaction', `Ava's mouth went flat, then tipped into a wink for Raven. The group pressed for the door, Micah at the front.`],
      ['Atmosphere added', `Ava winked at Raven. The group pressed toward the door, Micah at the front, the room already cooling behind them.`],
      ['Sensory close', `Ava winked. They moved for the door in a knot, Micah first, the hallway light hard after the dim of the room.`],
    ],
  },
};

const FALLBACK = {
  label: 'Analysis', icon: 'sparkle',
  analysis: [
    { icon: 'sparkle', h: 'Read', p: `A clean transitional beat — decompression between two set-pieces. The dialogue is doing less than the gesture, which is the right instinct for a scene change.` },
    { icon: 'target', h: 'One Lever', p: `If you want this beat to carry more, the verb on the group's exit ("pressed toward") is where I'd push — it's the only soft spot in an otherwise tight passage.` },
  ],
  actions: ['Generate 3 variations', 'Go deeper', 'Try another tool', 'Keep as-is'],
  variations: [
    ['Option A', `Ava winked at Raven. The group made for the door, Micah at the front.`],
    ['Option B', `The wink was the goodbye. Then they were moving, Micah leading them out.`],
    ['Option C', `Ava shook her head, winked, and let the group carry her toward the door behind Micah.`],
  ],
};

const toolData = id => ASSIST[id] || FALLBACK;

/* =========================================================================
   App
   ========================================================================= */
const PMApp = (() => {
  let currentTool = null;
  const LS = 'pm-dirB-log-v1';
  let log = [];           // [{role:'user'|'bot', html}]

  const $ = s => document.querySelector(s);
  const thread = () => $('#thread');

  const scrollDown = () => { const t = thread(); t.scrollTop = t.scrollHeight; };
  const save = () => { try { localStorage.setItem(LS, JSON.stringify({ log, currentTool })); } catch (e) {} };

  /* ---------- render helpers ---------- */
  const avatar = () => `<div class="chat-av"><img src="assets/prose-minion-book.png" alt=""></div>`;

  function pushUser(html) {
    const el = document.createElement('div');
    el.className = 'msg user';
    el.innerHTML = `<div class="bubble">${html}</div>`;
    thread().appendChild(el);
    log.push({ role: 'user', html }); save(); scrollDown();
  }

  function botShell() {
    const el = document.createElement('div');
    el.className = 'msg bot';
    el.innerHTML = `${avatar()}<div class="bubble"></div>`;
    thread().appendChild(el);
    return el.querySelector('.bubble');
  }

  function typingDots(bubble) {
    bubble.innerHTML = `<div class="typing"><span></span><span></span><span></span></div>`;
    scrollDown();
  }

  // Stream an array of analysis sections into a bubble, section by section.
  function streamSections(bubble, title, sections, done) {
    typingDots(bubble);
    setTimeout(() => {
      let html = `<div class="pm-result" style="margin:0"><h3 style="margin-top:0">${title}</h3></div>`;
      bubble.innerHTML = html;
      const panel = bubble.querySelector('.pm-result');
      let i = 0;
      const step = () => {
        if (i >= sections.length) { finalize(); return; }
        const s = sections[i++];
        const sec = document.createElement('div');
        sec.className = 'reveal';
        sec.innerHTML = `<h4>${ICONS[s.icon]({ size: 15 })} ${s.h}</h4><p>${s.p}</p>`;
        panel.appendChild(sec);
        scrollDown();
        setTimeout(step, 520);
      };
      const finalize = () => {
        // append result-panel action row
        const acts = document.createElement('div');
        acts.className = 'res-actions reveal';
        acts.innerHTML = `<span class="pm-sq plain" data-act="copy-result">${ICONS.copy({ size: 14 })}</span><span class="pm-sq plain" data-act="save-result">${ICONS.save({ size: 14 })}</span>`;
        panel.insertBefore(acts, panel.firstChild.nextSibling);
        log.push({ role: 'bot', html: bubble.innerHTML }); save();
        if (done) done();
      };
      setTimeout(step, 220);
    }, 650);
  }

  function streamPlain(bubble, html, done) {
    typingDots(bubble);
    setTimeout(() => {
      bubble.innerHTML = `<div class="reveal">${html}</div>`;
      log.push({ role: 'bot', html: bubble.innerHTML }); save(); scrollDown();
      if (done) done();
    }, 600);
  }

  function variationCardsHTML(variations) {
    return `<p style="margin:0 0 12px">Three passes — apply any one straight to the draft, or branch it to keep exploring:</p>
    <div class="var-stack">${variations.map((v, i) => `
      <div class="var-card">
        <div class="var-head"><span class="var-n">Variation ${i + 1}</span><span class="pm-pill">${v[0]}</span></div>
        <p class="var-text">${v[1]}</p>
        <div class="var-foot">
          <button class="vf" data-act="apply">${ICONS.check({ size: 13 })} Apply to draft</button>
          <button class="vf" data-act="copy">${ICONS.copy({ size: 13 })} Copy</button>
          <button class="vf" data-act="redo">${ICONS.refresh({ size: 13 })} Redo this one</button>
        </div>
      </div>`).join('')}</div>`;
  }

  /* ---------- quick-action bar ---------- */
  function renderQbar() {
    const bar = $('#qbar');
    if (!currentTool) { bar.innerHTML = ''; return; }
    const t = toolData(currentTool);
    bar.innerHTML = `
      <div class="qbar-lab">${ICONS.sparkle({ size: 13 })} Next, for <b>${t.label}</b></div>
      <div class="qbar-btns">
        ${t.actions.map((a, i) => `<button class="qa ${i === 0 ? 'primary' : ''}" data-action="${encodeURIComponent(a)}">${a}</button>`).join('')}
      </div>`;
  }

  /* ---------- left rail active state ---------- */
  function syncRail() {
    document.querySelectorAll('.slt[data-tool]').forEach(b => {
      b.classList.toggle('active', b.dataset.tool === currentTool);
    });
  }

  /* ---------- core actions ---------- */
  function runTool(id) {
    currentTool = id;
    const t = toolData(id);
    pushUser(`<p>Run <b>${t.label}</b> on the pinned excerpt.</p><div class="msg-tools"><span class="mt">${ICONS[t.icon]({ size: 12 })} ${t.label}</span></div>`);
    const b = botShell();
    streamSections(b, `${t.label} — Analysis`, t.analysis, () => { renderQbar(); });
    syncRail();
  }

  function doVariations() {
    const t = toolData(currentTool);
    const b = botShell();
    streamPlain(b, variationCardsHTML(t.variations));
  }

  function doGesture() {
    const b = botShell();
    streamPlain(b, `<p style="margin:0 0 10px">Swapping the second line for a beat that carries the same agreement:</p>
      <div class="var-card"><p class="var-text">"Ya." Raven's mouth twitched — agreement enough. Ava answered it with a wink, and the group spilled toward the door behind Micah.</p>
      <div class="var-foot"><button class="vf" data-act="apply">${ICONS.check({ size: 13 })} Apply</button><button class="vf" data-act="copy">${ICONS.copy({ size: 13 })} Copy</button><button class="vf" data-act="branch">${ICONS.branch({ size: 13 })} Branch</button></div></div>`);
  }

  function doKeep() {
    const b = botShell();
    streamPlain(b, `<p style="margin:0">Got it — leaving this beat as-is. I'll keep it in mind as context if you analyze the surrounding scene.</p>`);
  }

  function doGeneric(label) {
    const t = toolData(currentTool);
    const b = botShell();
    streamPlain(b, `<p style="margin:0 0 10px"><b>${label}</b> — here's the pass:</p>
      <div class="var-card"><p class="var-text">${t.variations[0][1]}</p>
      <div class="var-foot"><button class="vf" data-act="apply">${ICONS.check({ size: 13 })} Apply</button><button class="vf" data-act="copy">${ICONS.copy({ size: 13 })} Copy</button><button class="vf" data-act="branch">${ICONS.branch({ size: 13 })} Branch</button></div></div>`);
  }

  function runAction(label) {
    pushUser(`<p>${label}</p>`);
    const low = label.toLowerCase();
    if (low.includes('keep as-is')) return doKeep();
    if (low.includes('variation')) return doVariations();
    if (low.includes('gesture beat') || low === 'add a gesture beat') return doGesture();
    if (low.includes('show & tell') || low.includes('show &amp; tell')) return runTool('showtell');
    if (low.includes('cliché') || low.includes('cliche')) return runTool('cliche');
    if (low.includes('another tool') || low.includes('try another')) return openModal();
    return doGeneric(label);
  }

  function submitFreeText(text) {
    pushUser(`<p>${text.replace(/</g, '&lt;')}</p>`);
    const b = botShell();
    if (!currentTool) {
      streamPlain(b, `<p style="margin:0 0 10px">Happy to dig in. Pick a lens and I'll run it on the pinned excerpt — or I can give a quick overall read:</p>
        <div class="qbar-btns">${['dialogue', 'gestures', 'choreography', 'cliche'].map(id => `<button class="qa" data-tool="${id}">${toolData(id).label}</button>`).join('')}</div>`);
    } else {
      const t = toolData(currentTool);
      streamPlain(b, `<p style="margin:0 0 10px">On that — staying in the <b>${t.label}</b> lens:</p>
        <div class="var-card"><p class="var-text">${t.variations[1][1]}</p>
        <div class="var-foot"><button class="vf" data-act="apply">${ICONS.check({ size: 13 })} Apply</button><button class="vf" data-act="copy">${ICONS.copy({ size: 13 })} Copy</button><button class="vf" data-act="branch">${ICONS.branch({ size: 13 })} Branch</button></div></div>`);
    }
  }

  /* ---------- toast ---------- */
  let toastTimer;
  function toast(msg, icon = 'check') {
    const el = $('#toast');
    el.innerHTML = `${ICONS[icon]({ size: 15 })} <span>${msg}</span>`;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2100);
  }

  /* ---------- tools modal ---------- */
  function openModal() {
    const groups = ['Primary', 'Craft & Voice', 'Technical'];
    const html = `
      <div class="tm" role="dialog">
        <div class="tm-head">
          <div>
            <div class="pm-eyebrow" style="margin:0 0 6px">Prose Excerpt Assistant</div>
            <div style="font-size:20px;font-weight:700">Writing Tools</div>
            <div class="muted" style="font-size:13px;margin-top:4px">Pick an analysis — each runs on your pinned excerpt with the context brief attached.</div>
          </div>
          <button class="pm-btn ghost" style="padding:8px 10px" data-close="1">${ICONS.x({ size: 16 })}</button>
        </div>
        ${groups.map(g => `
          <div class="pm-rule-row"><div class="pm-eyebrow">${g}</div><hr></div>
          <div class="tm-grid">
            ${TOOLS.filter(t => t.g === g).map(t => {
              const id = toolIdFor(t.n);
              return `<div class="tm-card" data-tool="${id}">
                <div class="tm-ic">${ICONS[t.i]({ size: 20 })}</div>
                <div class="tm-n">${t.n}</div>
                <div class="tm-d">${t.d}</div>
              </div>`;
            }).join('')}
          </div>`).join('')}
      </div>`;
    const bd = $('#modal');
    bd.innerHTML = html;
    bd.classList.add('show');
  }
  function closeModal() { const bd = $('#modal'); bd.classList.remove('show'); bd.innerHTML = ''; }

  // map tool display name -> ASSIST key (only some are wired with bespoke content)
  function toolIdFor(name) {
    const map = {
      'Dialogue & Beats': 'dialogue', 'Prose': 'prose', 'Gestures': 'gestures',
      'Cliché': 'cliche', 'Repetition': 'repetition', 'Choreography': 'choreography',
      'Show & Tell': 'showtell',
    };
    return map[name] || 'fallback';
  }

  /* ---------- left rail ---------- */
  function renderRail() {
    const railTools = ['dialogue', 'prose', 'gestures', 'choreography', 'cliche', 'showtell'];
    $('#rail').innerHTML = `
      <div class="sl-block">
        <div class="flex between center">
          <div class="pm-eyebrow" style="margin:0">${ICONS.pin({ size: 12 })} Working Excerpt</div>
          <span class="pm-pill">Pinned</span>
        </div>
        <div class="sl-excerpt">${EXCERPT}</div>
        <div class="sl-meta"><span class="mono">Drafts/workshop/chapter-5.8-rewrite.md</span><span class="mono accent">164 words</span></div>
      </div>

      <div class="sl-block">
        <div class="pm-eyebrow">Context Brief</div>
        <p class="muted" style="font-size:12.5px;margin:0 0 9px;line-height:1.5">YA contemporary · Christian mysticism · grief narrative. Voice guides attached for Ava &amp; Raven.</p>
        <div class="pm-chips">${CONTEXT_CHIPS.map(c => `<span class="pm-chip">${c}</span>`).join('')}</div>
      </div>

      <div class="sl-block grow">
        <div class="flex between center"><div class="pm-eyebrow" style="margin:0">Tools</div><span class="muted mono" style="font-size:10px">14 total</span></div>
        <div class="sl-tools">
          ${railTools.map(id => `<button class="slt" data-tool="${id}">${ICONS[toolData(id).icon]({ size: 15 })} ${toolData(id).label}</button>`).join('')}
          <button class="slt ghost" data-open-modal="1">${ICONS.grid({ size: 15 })} All 14 tools…</button>
        </div>
      </div>`;
  }

  /* ---------- welcome / restore ---------- */
  function welcome() {
    const b = botShell();
    b.innerHTML = `<div class="reveal"><p style="margin:0 0 12px">I've got your excerpt pinned on the left — <b>164 words</b> from chapter 5.8, with Ava &amp; Raven's voice guides attached. Pick a lens to analyze it, or just ask me something.</p>
      <div class="qbar-btns">${['dialogue', 'gestures', 'choreography', 'cliche'].map(id => `<button class="qa" data-tool="${id}">${toolData(id).label}</button>`).join('')}</div></div>`;
    log.push({ role: 'bot', html: b.innerHTML }); save();
  }

  function restore(saved) {
    currentTool = saved.currentTool || null;
    log = saved.log || [];
    const t = thread();
    t.innerHTML = '';
    log.forEach(m => {
      const el = document.createElement('div');
      el.className = `msg ${m.role}`;
      el.innerHTML = m.role === 'bot' ? `${avatar()}<div class="bubble">${m.html}</div>` : `<div class="bubble">${m.html}</div>`;
      t.appendChild(el);
    });
    renderQbar(); syncRail(); scrollDown();
  }

  function resetThread() {
    log = []; currentTool = null;
    thread().innerHTML = '';
    renderQbar(); syncRail();
    welcome();
    save();
  }

  /* ---------- events ---------- */
  function wire() {
    document.body.addEventListener('click', e => {
      const t = e.target.closest('[data-tool],[data-action],[data-act],[data-open-modal],[data-close],[data-reset],[data-model-toggle],[data-model]');
      if (!t) {
        if (!e.target.closest('#modelMenu') && !e.target.closest('[data-model-toggle]')) $('#modelMenu')?.classList.remove('show');
        if (e.target.id === 'modal') closeModal();
        return;
      }
      if (t.dataset.tool) { closeModal(); runTool(t.dataset.tool); }
      else if (t.dataset.action) { runAction(decodeURIComponent(t.dataset.action)); }
      else if (t.dataset.openModal) { openModal(); }
      else if (t.dataset.close) { closeModal(); }
      else if (t.dataset.reset) { resetThread(); }
      else if (t.dataset.modelToggle) { $('#modelMenu').classList.toggle('show'); }
      else if (t.dataset.model) { $('#modelLabel').textContent = t.dataset.model; $('#modelMenu').classList.remove('show'); toast('Model set to ' + t.dataset.model, 'bot'); }
      else if (t.dataset.act) {
        const a = t.dataset.act;
        if (a === 'apply') toast('Applied to chapter-5.8-rewrite.md', 'check');
        else if (a === 'copy' || a === 'copy-result') toast('Copied to clipboard', 'copy');
        else if (a === 'save-result') toast('Saved to Drafts/notes/', 'save');
        else if (a === 'redo') { doVariations(); }
        else if (a === 'branch') toast('Branched — exploring in parallel', 'branch');
      }
    });

    const input = $('#composer-input');
    const send = () => { const v = input.value.trim(); if (!v) return; input.value = ''; submitFreeText(v); };
    $('#composer-send').addEventListener('click', send);
    input.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } });
    $('#composer-tools').addEventListener('click', openModal);
  }

  function init() {
    renderRail();
    wire();
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(LS) || 'null'); } catch (e) {}
    if (saved && saved.log && saved.log.length) restore(saved);
    else welcome();
  }

  return { init, reset: resetThread };
})();

document.addEventListener('DOMContentLoaded', PMApp.init);
