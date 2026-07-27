/* Prose Minion — dismissible multi-page notice modal. Needs icons.js, pm-widgets.js (cwOpen/cwClose/cwXBtn). */
const PMNotify = (() => {
  const KEY = 'pm-wk-notice-dsa-v1';
  const PAGES = [
    {t:'Welcome — this is a Beta experience', tag:'beta',
     d:`The Workshop is new and still settling. There’s no written guide yet — this tour is it, so feel free to explore: nothing here spends anything until you explicitly press a button that says so, and nothing you try can damage your project files.`},
    {t:'Works best with a project folder configured', tag:'setup',
     d:`Point the <b>Open Folder</b> setting (see the Settings tab) at your project, organized the way the browse-project modal expects: <b>Characters</b>, <b>Locations &amp; Settings</b>, <b>Themes</b>, <b>Project Brief materials</b>, and individual files per chapter. Once configured, assistants can read those files as context — and the category picker maps straight onto your folders.`},
    {t:'Assistants — a host, and guests', tag:'primer',
     d:`Every session has a <b>host</b> (Jill by default — a warm developmental partner) and you can invite <b>guest personas</b>, each with a narrow specialty: rhythm &amp; pacing, continuity, dialogue, voice &amp; POV, and more. Guests read beside your host, never replace it. Switch hosts or invite from the rail above the composer.`},
    {t:'The conversation controller', tag:'primer',
     d:`The chip beside the composer sets how the room responds: <b>mode</b> (how opinionated), <b>expression</b> (how much it says), and <b>depth</b> (how far it reads into things). It’s per-session, visible at all times, and never changes silently.`},
    {t:'Tools — one run, one visible result', tag:'primer',
     d:`Fourteen analyses (dialogue &amp; beats, prose, cliché, show &amp; tell…) run <b>once</b> on your excerpt with your context attached. Each result lands in the thread as a visible event — nothing runs in the background. Tools unlock when an excerpt is set.`},
    {t:'Agents can do real work', tag:'primer',
     d:`With a configured project, assistants can <b>run analyses</b>, <b>read project files</b> you attach, <b>use the dictionary</b>, and <b>run isolated tools on specific variations</b> — a one-off pass on one option without touching the conversation. Widgets go further: play first, and only what you deliberately bring back ever reaches the room.`}
  ];
  let idx = 0, dsa = false;
  function dismissed(){ try { return localStorage.getItem(KEY) === '1'; } catch(_) { return false; } }
  function build(){
    const root = document.createElement('div'); root.className = 'wk-notice';
    root.appendChild(cwXBtn());
    root.insertAdjacentHTML('beforeend', `
      <div class="cw-eyebrow">Workshop <span class="cw-stag beta">beta</span></div>
      <div class="nt-page"></div>
      <div class="nt-nav">
        <button class="nt-arr" data-nav="-1" aria-label="Previous">${cwIc('chevDown',{size:14,sw:2})}</button>
        <div class="nt-dots"></div>
        <button class="nt-arr" data-nav="1" aria-label="Next">${cwIc('chevDown',{size:14,sw:2})}</button>
      </div>
      <div class="nt-foot">
        <button class="nt-dsa" role="checkbox" aria-checked="false"><span class="bx">${cwIc('check',{size:9,sw:3})}</span>Don’t show again <span class="all">· applies to all ${PAGES.length} notices in this box</span></button>
        <button class="cw-btn primary nt-dismiss">Dismiss</button>
      </div>`);
    const page = root.querySelector('.nt-page'), dots = root.querySelector('.nt-dots');
    const render = () => {
      const p = PAGES[idx];
      page.innerHTML = `<span class="k">${idx+1} / ${PAGES.length} · ${p.tag}</span><h2>${p.t}</h2><p>${p.d}</p>`;
      dots.innerHTML = PAGES.map((_,i)=>`<button class="dot${i===idx?' on':''}" data-go="${i}" aria-label="Notice ${i+1}"></button>`).join('');
      root.querySelector('[data-nav="-1"]').disabled = idx===0;
      root.querySelector('[data-nav="1"]').disabled = idx===PAGES.length-1;
      root.querySelector('.nt-dismiss').textContent = 'Dismiss';
    };
    root.addEventListener('click', e => {
      const nav = e.target.closest('[data-nav]');
      if (nav && !nav.disabled){ idx = Math.min(PAGES.length-1, Math.max(0, idx + +nav.dataset.nav)); render(); return; }
      const go = e.target.closest('[data-go]');
      if (go){ idx = +go.dataset.go; render(); return; }
      if (e.target.closest('.nt-dsa')){
        dsa = !dsa;
        const b = root.querySelector('.nt-dsa');
        b.classList.toggle('on', dsa); b.setAttribute('aria-checked', String(dsa));
        return;
      }
      if (e.target.closest('.nt-dismiss')){
        if (dsa){ try { localStorage.setItem(KEY,'1'); } catch(_){} }
        cwClose();
      }
    });
    render();
    return root;
  }
  function open(force){
    if (!force && dismissed()) return false;
    idx = 0; dsa = false;
    cwOpen(build(), true);
    return true;
  }
  return { open, dismissed, KEY };
})();
window.PMNotify = PMNotify;
