/*
 * The headline's Re-analyze through its own rerun, for the Slice 4I visual
 * harness (harness.js; PR #166 N-02). Kept apart so the harness stays a
 * readable size.
 */
/**
 * The headline's Re-analyze through its own rerun (PR #166 N-02): focus it,
 * press Enter, then replay the host's moments of that rerun (in flight,
 * landed; pressed again, in flight, failed), each as a page that watched the
 * run receives it. The same button must hold the focus at every step, and
 * say what the board says. A capture of the headline at each step.
 */
async function headlineRerun(tab, capture, { states, selector }) {
  const { rereading, reread, failing, failed } = states;
  const button = tab.locator(`${selector} .pm-lb-call-button`);
  if (await button.count() !== 1) {
    return { steps: [], problems: [`the read headline has ${await button.count()} Analyze controls, not 1`] };
  }
  await button.focus();
  await tab.evaluate(() => { window.__pmHeadlineAnalyze = document.activeElement; });
  const look = (step) => tab.evaluate(({ step, selector }) => {
    const kept = window.__pmHeadlineAnalyze;
    return {
      step,
      same: document.querySelector(`${selector} .pm-lb-call-button`) === kept,
      connected: kept.isConnected,
      focused: document.activeElement === kept,
      active: document.activeElement ? document.activeElement.tagName : null,
      label: kept.querySelector('.pm-lb-call-label')?.textContent ?? null,
      name: kept.getAttribute('aria-label'),
      disabled: kept.getAttribute('aria-disabled') === 'true',
      headline: Boolean(document.querySelector('.pm-lb-headline-reading')),
      failed: document.querySelector('.pm-lb-headline-state .is-failed')?.textContent ?? null
    };
  }, { step, selector });
  const replay = async (state) => {
    await tab.evaluate((data) => {
      window.__pmScenario = data;
      for (const message of data.messages) { window.postMessage(message, '*'); }
    }, state);
    await tab.waitForTimeout(400);
  };
  const press = async () => {
    const before = await tab.evaluate(() => window.__pmPosted.filter((message) => message.type === 'lightbox_run').length);
    await tab.keyboard.press('Enter');
    await tab.waitForTimeout(100);
    return tab.evaluate((before) => window.__pmPosted.filter((message) => message.type === 'lightbox_run').slice(before).map((message) => message.payload.scope), before);
  };
  const want = {
    read: { label: 'Re-analyze', disabled: false, headline: true },
    analyzing: { label: 'Analyzing…', disabled: true, headline: false },
    landed: { label: 'Re-analyze', disabled: false, headline: true },
    'analyzing-again': { label: 'Analyzing…', disabled: true, headline: false },
    failed: { label: 'Analyze', disabled: false, headline: false }
  };
  const steps = [await look('read')];
  const sent = [await press()];
  await replay(rereading);
  steps.push(await look('analyzing'));
  await capture('analyzing');
  await replay(reread);
  steps.push(await look('landed'));
  await capture('landed');
  sent.push(await press());
  await replay(failing);
  steps.push(await look('analyzing-again'));
  await replay(failed);
  steps.push(await look('failed'));
  await capture('failed');
  const problems = [];
  const scope = JSON.stringify({ mode: 'group', group: 'A', lens: 'headline' });
  sent.forEach((scopes, index) => {
    if (scopes.length !== 1 || JSON.stringify(scopes[0]) !== scope) { problems.push(`press ${index + 1} on the headline's Analyze sent ${JSON.stringify(scopes)}, not ${scope}`); }
  });
  for (const seen of steps) {
    const expected = want[seen.step];
    if (!seen.same || !seen.connected) { problems.push(`${seen.step}: the headline's Analyze was replaced`); }
    if (!seen.focused) { problems.push(`${seen.step}: the focus fell to ${seen.active}`); }
    if (seen.label !== expected.label) { problems.push(`${seen.step}: it says "${seen.label}", not "${expected.label}"`); }
    if (!(seen.name ?? '').startsWith(`${expected.label}, call A:`)) { problems.push(`${seen.step}: named "${seen.name}"`); }
    if (seen.disabled !== expected.disabled) { problems.push(`${seen.step}: ${seen.disabled ? 'disabled' : 'enabled'}, not ${expected.disabled ? 'disabled' : 'enabled'}`); }
    if (seen.headline !== expected.headline) { problems.push(`${seen.step}: ${seen.headline ? 'a' : 'no'} headline reading shown`); }
  }
  if (!steps.at(-1).failed) { problems.push('failed: the headline\'s failure is not shown under it'); }
  return { steps, sent, problems };
}

module.exports = { headlineRerun };
