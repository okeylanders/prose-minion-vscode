/* Prose Minion — wide multi-page notice modal with annotated screenshots. Needs icons.js, pm-widgets.js (cwOpen/cwClose/cwXBtn). */
const PMNotify = (() => {
  const KEY = 'pm-wk-notice-dsa-v1';
  const U = 'uploads/Screenshot 2026-07-27 at ';
  const PAGES = [
    {tag:'beta', t:'Welcome to the Workshop beta',
     d:`The Workshop is a conversation space for working with a host, focused guests, and analysis instruments. It is still settling, so this short tour points to the controls that matter most. You decide when to send a message, run a tool, attach context, or apply text; Prose Minion never changes project files on its own.`,
     wt:'What you are looking at',
     m:[{s:'12.02.06 PM',w:520,ar:'884/150'},{s:'12.02.37 PM',w:560,ar:'1320/338'}], l:[]},
    {tag:'setup', t:'Start with an open project folder',
     d:`Open your writing project folder in VS Code. Then use the <b>Prose Minion Settings</b> gear in the sidebar to tell the extension where character sheets, locations, project notes, drafts, and manuscript chapters live. For the best results, split drafts and manuscripts into individual chapter files so assistants can find and read the right material without treating a whole novel as one document.`,
     wt:'Where to do it',
     m:[{s:'12.06.02 PM',w:216,ar:'797/1217',crop:161.3,b:[[23.2,26.4,68.4,4.8,1]]},{s:'1.46.23 PM',w:400,ar:'882/446',b:[[91.3,7.4,5.2,13.2,2]]}],
     l:[['1','File → Open Folder…','point VS Code at the project root before anything else.'],['2','Settings gear','top-right of the Prose Minion sidebar; opens Project Resource Locations.']]},
    {tag:'primer', t:'Choose a host, then invite guests',
     d:`Every session has a <b>host</b>. Jill is the default, but you can choose a different host before the conversation begins. You can also invite <b>guest personas</b> with focused specialties such as rhythm &amp; pacing, continuity, dialogue, or voice &amp; POV; they work beside the host, never replace it. For especially distinctive persona voices and strong judgment about when to read project resources or run another analysis, try <b>Gemini 3.6 Flash</b>. <b>GPT-5.6 Terra</b> and <b>GPT-5.6 Sol</b> are also excellent choices.`,
     wt:'Where to look',
     m:[{s:'12.02.06 PM',w:520,ar:'884/150',b:[[6.4,19,18.9,52,1],[67,19,31.4,52,2]]},{s:'12.02.15 PM',w:340,ar:'516/140',b:[[22.9,33,24.8,45,3],[48.4,33,41.9,45,4]]}],
     l:[['1','Host chip','set before the conversation begins.'],['2','Model picker','Gemini 3.6 Flash, GPT-5.6 Terra, GPT-5.6 Sol.'],['3','Talking to','who is currently in the room.'],['4','Invite guest','add a focused specialist beside the host.']]},
    {tag:'primer', t:'Set the room’s conversation style',
     d:`Find the diamond-shaped <b>Conversation Controller</b> chip in the composer controls. The <b>Behavior</b> tab sets how host and guest personas respond: <b>mode</b> (how opinionated), <b>expression</b> (how much they say), and <b>depth</b> (how far they read into things). Those choices are per-session, stay visible, and never change silently. The <b>About you</b> tab lets you choose how the room addresses you and share a short writer profile as background context. In <b>Advanced</b>, you can let personas research the live web when it helps; their replies show each source as a clickable citation pill. These conversation controls do not apply to direct instrument threads.`,
     wt:'Where to look',
     m:[{s:'12.02.37 PM',w:560,ar:'1320/338',b:[[32.4,52.5,28.7,22,1]]},
        {row:[{s:'12.51.13 PM',c:'Behavior'},{s:'12.48.45 PM',c:'About you'},{s:'12.49.00 PM',c:'Advanced'}]}],
     l:[['1','Conversation Controller','the diamond chip in the composer bar; three tabs inside.']]},
    {tag:'primer', t:'Tools — run them directly, or ask a persona',
     d:`Run any of the fourteen analyses directly against a pinned excerpt and its report lands visibly in the thread. Or ask your host or a guest to run an isolated analysis on a specific line, variation, or question from the conversation. Just ask: the persona can decide when a tool would help and bring the useful result back into the room. Direct tool runs unlock when an excerpt is set.`,
     wt:'Where to look',
     m:[{s:'12.02.37 PM',w:560,ar:'1320/338',b:[[77.2,52.5,11.2,22,1],[3.5,52.5,6,22,2]]}],
     l:[['1','Tools','the fourteen analyses; enabled once an excerpt is pinned.'],['2','+','pin the excerpt and attach project context.']]},
    {tag:'primer', t:'Agents can work with your project',
     d:`With project paths configured, hosts and guests can <b>find and read relevant project files</b> when the conversation calls for them — you do not need to attach every file by hand. They can also use the dictionary, run analyses, and inspect a particular variation without derailing the main conversation. The <b>Widgets</b> browser is a preview of tools still to come; it does not launch widgets yet.`,
     wt:'Where to look',
     m:[{s:'12.02.37 PM',w:560,ar:'1320/338',b:[[63.8,52.5,12.4,22,1]]}],
     l:[['1','Widgets','a preview browser; nothing launches yet.']]}
  ];
  let idx = 0, dsa = false;
  function dismissed(){ try { return localStorage.getItem(KEY) === '1'; } catch(_) { return false; } }
  function shot(o){
    const boxes = (o.b||[]).map(b => `<span class="nt-bx" style="left:${b[0]}%;top:${b[1]}%;width:${b[2]}%;height:${b[3]}%"><i>${b[4]}</i></span>`).join('');
    const img = `<img src="${U}${o.s}.png" alt="" style="${o.crop ? `position:absolute;top:0;left:0;width:${o.crop}%` : 'width:100%;display:block'}">`;
    return `<figure class="nt-fig" style="aspect-ratio:${o.ar};max-width:${o.w||240}px">${img}${boxes}</figure>`;
  }
  function media(p){
    return p.m.map(o => o.row
      ? `<div class="nt-row">${o.row.map(x => `<figure class="nt-fig sm"><span class="ph"><img src="${U}${x.s}.png" alt=""></span><figcaption>${x.c}</figcaption></figure>`).join('')}</div>`
      : shot(o)).join('');
  }
  function build(){
    const root = document.createElement('div'); root.className = 'wk-notice';
    root.appendChild(cwXBtn());
    root.insertAdjacentHTML('beforeend', `
      <div class="cw-eyebrow">Workshop <span class="cw-stag beta">beta</span></div>
      <div class="nt-body">
        <div class="nt-well">
          <div class="nt-well-t"></div>
          <div class="nt-media"></div>
          <ul class="nt-leg"></ul>
        </div>
        <div class="nt-page"></div>
      </div>
      <div class="nt-foot">
        <button class="nt-dsa" role="checkbox" aria-checked="false"><span class="bx">${cwIc('check',{size:9,sw:3})}</span>Don’t show again <span class="all">· applies to all ${PAGES.length} notices in this box</span></button>
        <div class="nt-nav">
          <button class="nt-arr" data-nav="-1" aria-label="Previous">${cwIc('chevDown',{size:14,sw:2})}</button>
          <div class="nt-dots"></div>
          <button class="nt-arr" data-nav="1" aria-label="Next">${cwIc('chevDown',{size:14,sw:2})}</button>
          <button class="cw-btn primary nt-dismiss">Dismiss</button>
        </div>
      </div>`);
    const page = root.querySelector('.nt-page'), dots = root.querySelector('.nt-dots');
    const render = () => {
      const p = PAGES[idx];
      page.innerHTML = `<span class="k"><b>${idx+1} / ${PAGES.length}</b> · ${p.tag}</span><h2>${p.t}</h2><p>${p.d}</p>`;
      root.querySelector('.nt-well-t').textContent = p.wt;
      root.querySelector('.nt-media').innerHTML = media(p);
      root.querySelector('.nt-leg').innerHTML = p.l.map(x => `<li><span class="n">${x[0]}</span><span><b>${x[1]}</b> — ${x[2]}</span></li>`).join('');
      dots.innerHTML = PAGES.map((_,i)=>`<button class="dot${i===idx?' on':''}" data-go="${i}" aria-label="Notice ${i+1}"></button>`).join('');
      root.querySelector('[data-nav="-1"]').disabled = idx===0;
      root.querySelector('[data-nav="1"]').disabled = idx===PAGES.length-1;
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
