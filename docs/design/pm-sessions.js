/* =========================================================================
   Prose Minion — Session persistence UI. Needs pm-widgets.js (cwOpen/cwClose/
   cwXBtn) + pm-workshop.js (window.PMW). Exposes window.PMSessions.
   ========================================================================= */
const PMSessions = (() => {
  const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const trashIc = (o={}) => IC('<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/>', Object.assign({sw:1.7}, o));
  const P = () => window.PMW;

  const EX = {
    ch58: {title:'Pentecost', source:'Drafts/chapter-5.8.md', version:2, words:2015, text:`# Pentecost\n\nThey moved toward the auditorium as a group, but Nate felt himself floating slightly above the moment—in that hush before the brushstroke. The edge of something breaking.\n\nThe auditorium doors loomed ahead, heavy and dark.`},
    ch6:  {title:'Blackout — the doors', source:'Drafts/chapter-6.md', version:1, words:2380, text:`# Blackout\n\nThe lights died all at once, and the gym became a throat. Kayla reached for a wall that had been there a second ago.\n\n"Nate?" Her voice went nowhere. "Nate, say something."`},
    ch5:  {title:'Prom confrontation', source:'Drafts/chapter-5.md', version:3, words:1740, text:`# The gym floor\n\nRaven crossed the floor like she owned the deed to it. "You brought it here," she said. "To prom. Of all the nights."\n\nBradley didn't answer, which was its own kind of answer.`},
    ch4:  {title:'Chapter 4 opening', source:'Drafts/chapter-4.md', version:1, words:3120, text:`# Chapter Four\n\nMorning came the way it always did in that town, gray and unhurried, indifferent to the thing they'd buried in the field the night before and the promises they'd made over the loose dirt.`},
    raven:{title:'Raven voice study', source:'Characters/Raven/raven-voice-guide.md', version:1, words:980, text:`Raven — voice guide\n\nClipped. Sardonic when cornered. Never explains a joke. Trusts action over apology, and reads a room in the first three seconds she's in it.`},
  };
  const T = (...lines) => lines.map(l => ({who:l[0], text:l[1], by:l[2]}));

  let SESSIONS = [
    {id:'cur', current:true, title:'Pentecost — auditorium beat', host:'jill', turns:14, group:'today', rel:'autosaved · just now',
     excerpt:{...EX.ch58}, key:'chapter-5.8.md',
     preview:'Give one speaker a gesture instead of a word right before the group exit.',
     context:[{kind:'text',label:'testing…',words:1},{kind:'file',label:'character-ava.md',words:2738},{kind:'file',label:'character-set-piece-moments.md',words:1908},{kind:'file',label:'character-chen.md',words:1252}],
     todo:[{text:'Rework the exit beat — gesture, not a second monosyllable.',done:false},{text:'Check Micah is anchored before the door.',done:true}],
     mode:'balanced', expr:'amplified',
     transcript:T(['you','Look at the exit beat at the end of the Pentecost scene — does the dialogue land?'],['bot','The clipped <em>"Ya." / "Yep."</em> earns its terseness, but two bare monosyllables back-to-back flatten the rhythm right before the group exit. Let one speaker answer with a gesture instead of a word.'],['you','Do a tighter pass.'],['bot','Ava caught Raven\'s eye and winked. They moved for the door, Micah breaking the lead.'])},
    {id:'s2', title:'Pentecost — dialogue pass', host:'dev', turns:9, group:'today', rel:'2h ago',
     excerpt:{...EX.ch58, version:1}, key:'chapter-5.8.md',
     preview:'Nate and Kayla read as one voice here — no tags, no distinct rhythm.',
     context:[{kind:'file',label:'character-chen.md',words:1252}],
     todo:[], mode:'analysis', expr:'full',
     transcript:T(['you','Are Nate and Kayla distinct in this passage?'],['bot','Not yet — both speak in short declaratives with no tags. Give Kayla a hedge and Nate a clipped answer and they separate immediately.'])},
    {id:'s3', title:'Kayla — blackout scene', host:'margot', turns:22, group:'week', rel:'Yesterday · 9:14 PM',
     excerpt:{...EX.ch6}, key:'chapter-6.md',
     preview:'Narration slips out of Kayla’s close third the moment the lights die.',
     context:[{kind:'file',label:'character-kayla.md',words:1105},{kind:'file',label:'blackout-town.md',words:1480}],
     todo:[{text:'Hold close-third through the blackout — no omniscient camera.',done:false}],
     mode:'balanced', expr:'amplified', participants:['margot','penny'],
     transcript:T(['you','Does the POV hold when the lights go out?'],['bot','It breaks — you cut to what the room looks like from <em>outside</em> Kayla. In pitch dark, close third should get only what she hears and touches.','margot'],['you','Penny, does that lose you?'],['bot','It does — the second the lights die I’m watching the gym instead of feeling the dark with her. Bring me back to her hands.','penny'])},
    {id:'s4', title:'Prom confrontation', host:'edna', turns:6, group:'week', rel:'Yesterday · 2:03 PM',
     excerpt:{...EX.ch5}, key:'chapter-5.md',
     preview:'Raven reacts to the token before she could plausibly know about it.',
     context:[], todo:[], mode:'analysis', expr:'full',
     transcript:T(['you','Any logic breaks in the gym scene?'],['bot','One: Raven flinches at the marked token, but she hasn\'t been on-page since it appeared. Either move her earlier or cut the reaction.'])},
    {id:'s5', title:'Chapter 4 opening', host:'felix', turns:17, group:'week', rel:'Mon · Jul 20',
     excerpt:{...EX.ch4}, key:'chapter-4.md',
     preview:'Three long sentences in a row — the open needs a short one to land.',
     context:[{kind:'file',label:'chapter-4.md',words:3120}], todo:[], mode:'balanced', expr:'full',
     transcript:T(['you','How\'s the rhythm of the opening?'],['bot','Dense — three long compound sentences stack before the reader gets a breath. One short sentence at the top would set the pace and let the third land.'])},
    {id:'s6', title:'Raven voice study', host:'penny', turns:11, group:'earlier', rel:'Jul 14',
     excerpt:{...EX.raven}, key:'raven-voice-guide.md',
     preview:'As a reader I still don’t know why Raven trusts Nate this fast.',
     context:[], todo:[], mode:'conversational', expr:'full',
     transcript:T(['you','Read this as a first-timer — does Raven work?'],['bot','I like her, but I don\'t know why she trusts Nate so quickly. The page hasn\'t earned it yet — give me one beat where he proves it.'])},
    {id:'s7', title:'Theme sweep — grief', host:'agnes', turns:28, group:'earlier', rel:'Jul 9',
     excerpt:{...EX.ch58, version:1}, key:'chapter-5.8.md',
     preview:'The brushstroke image carries the grief; the doorway does less.',
     context:[{kind:'file',label:'thematic-structure.md',words:1150}], todo:[], mode:'balanced', expr:'amplified',
     transcript:T(['you','Which images are actually pulling weight on grief here?'],['bot','The brushstroke — "the hush before the brushstroke" — is doing real thematic work. The looming doorway is a stock beat; make it specific to Nate or let the brushstroke stand alone.'])},
  ];

  const GROUPS = {today:'Today', week:'This week', earlier:'Earlier'};
  const now = () => 'Jul 23';
  const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,42);

  function sOpen(inner, cls){ cwOpen(inner); const m=document.querySelector('.cw-ov .cw-modal'); if(m&&cls) m.classList.add(...cls.split(' ')); return m; }
  function hostChip(id, size){ return P().hostGlyphs(id, size); }

  /* ---------- dropdown menu ---------- */
  function renderMenu(el){
    if (!el) return;
    const recents = SESSIONS.filter(s=>!s.current).slice(0,3);
    el.innerHTML = `
      <div class="mh">Session</div>
      <button class="wk-mitem" data-s-act="new">${ICONS.refresh({size:15,sw:1.7})} New session <span class="kbd">⌘⇧N</span></button>
      <button class="wk-mitem" data-s-act="save">${ICONS.save({size:15,sw:1.7})} Save session… <span class="kbd">⌘S</span></button>
      <hr>
      <button class="wk-mitem" data-s-act="browse">${ICONS.cards({size:15,sw:1.7})} Open prior session…</button>
      <div class="mh">Recent</div>
      ${recents.map(s=>`<button class="wk-mrec" data-open="${s.id}"><span class="t">${esc(s.title)}</span><span class="m">${esc(P().hostName(s.host))} · ${esc(s.rel)}</span></button>`).join('')}
      <hr>
      <button class="wk-mitem" data-s-act="browse">${ICONS.search({size:15,sw:1.7})} Browse all sessions…</button>`;
    el.onclick = e => {
      const item = e.target.closest('[data-s-act],[data-open]');
      if (!item) return;
      el.classList.remove('open');
      if (item.dataset.open){ const s=SESSIONS.find(x=>x.id===item.dataset.open); if(s) P().loadSession(s); return; }
      const a = item.dataset.sAct;
      if (a==='new') P().newSession();
      if (a==='save') openSave();
      if (a==='browse') openBrowser();
    };
  }

  /* ---------- save dialog ---------- */
  function openSave(){
    const snap = P().currentSnapshot();
    const exTitle = snap.excerpt ? snap.excerpt.title : 'Untitled session';
    const autoName = `${exTitle} — ${snap.hostName} — ${now()}`;
    const parts = snap.participants || [snap.host];
    const guests = parts.filter(p=>p!==snap.host);
    const partLabel = guests.length ? `${snap.hostName} + ${guests.length} guest${guests.length===1?'':'s'}` : `${snap.hostName} (host, solo)`;
    const root = document.createElement('div'); root.className='cw-sheet-wrap';
    root.appendChild(cwXBtn());
    const incl = [
      ['Excerpt', snap.excerpt ? `v${snap.excerpt.version} · ${P().fmt(snap.excerpt.words)} words` : 'none pinned yet'],
      ['Transcript', `${snap.turns} turn${snap.turns===1?'':'s'} · complete`],
      ['Participants', partLabel],
      ['Context', `${snap.context.length} attachment${snap.context.length===1?'':'s'}`],
      ['To-do list', `${snap.todo.length} item${snap.todo.length===1?'':'s'}`],
      ['Room settings', `${P().MODES[snap.mode]} · ${snap.expr.charAt(0).toUpperCase()+snap.expr.slice(1)}`],
    ];
    root.insertAdjacentHTML('beforeend', `
      <div class="wk-mhead"><div class="wk-mkicker">Workshop · Session</div><h2>Save session</h2><p class="wk-msub">Writes a complete snapshot you can reopen later. Your working room also autosaves on its own.</p></div>
      <div class="wk-sheet-body"><div class="sv-body">
        <div class="sv-field"><label class="sv-label">Session name</label><input class="sv-input" id="sv-name" value="${esc(autoName)}" autocomplete="off"><div class="sv-path">${ICONS.doc({size:12})}<span>prose-minion/sessions/<b id="sv-slug">${esc(slug(autoName))}</b>.json</span></div></div>
        <div class="sv-incl"><div class="h">Included in this snapshot</div>${incl.map(r=>`<div class="sv-inclrow">${ICONS.check({size:13,sw:2.4})}<span>${r[0]}</span><span class="m">${r[1]}</span></div>`).join('')}</div>
      </div></div>
      <div class="wk-sheet-foot"><span class="note">Autosaves to <b style="color:var(--muted)">current.json</b>; this creates a named copy.</span><button class="mbtn" data-cancel>Cancel</button><button class="mbtn primary" data-save>Save session</button></div>`);
    const name = root.querySelector('#sv-name'), slugEl = root.querySelector('#sv-slug');
    name.addEventListener('input', ()=>{ slugEl.textContent = slug(name.value)||'untitled'; });
    root.querySelector('[data-cancel]').addEventListener('click', cwClose);
    root.querySelector('[data-save]').addEventListener('click', ()=>{
      const nm = name.value.trim() || autoName;
      const ns = {id:'saved-'+Date.now(), title:nm, host:snap.host, turns:snap.turns, group:'today', rel:'just now',
        excerpt:snap.excerpt?{...snap.excerpt}:null, key:snap.excerpt?snap.excerpt.source.split('/').pop():'—',
        preview:'Saved snapshot of the current working room.', context:snap.context.map(x=>({...x})), todo:snap.todo.map(x=>({...x})),
        mode:snap.mode, expr:snap.expr, transcript:[]};
      SESSIONS = SESSIONS.filter(s=>s.current).concat(ns, SESSIONS.filter(s=>!s.current));
      P().setSessionName(nm); cwClose(); P().toast('Session saved — '+nm, 'save');
    });
    sOpen(root, 'sheet');
    setTimeout(()=>{ name.focus(); name.select(); }, 40);
  }

  /* ---------- session browser ---------- */
  function openBrowser(){
    const view = {query:'', groupBy:'date', editingId:null, confirmDel:null};
    const root = document.createElement('div'); root.className='cw-sheet-wrap';
    root.appendChild(cwXBtn());
    root.insertAdjacentHTML('beforeend', `
      <div class="wk-mhead"><div class="wk-mkicker">Workshop · Sessions</div><h2>Open a prior session</h2><p class="wk-msub">Reopening restores the excerpt, context, and transcript. Room memory from a saved session isn't retained — the persona starts fresh.</p></div>
      <div class="sb-toolbar">
        <div class="sb-search"><span class="si">${ICONS.search({size:16})}</span><input id="sb-q" placeholder="Search names and session content…"><span class="grep">greps content</span></div>
        <div class="sb-group"><span class="lab">Group by</span><div class="sb-seg"><button class="on" data-grp="date">Date</button><button data-grp="excerpt">Excerpt</button></div></div>
      </div>
      <div class="wk-sheet-body"><div class="sb-body" id="sb-body"></div></div>
      <div class="wk-sheet-foot"><span class="note">Your working room autosaves to <b style="color:var(--muted)">current.json</b> and restores automatically when you reopen Workshop.</span><button class="mbtn" data-newses>${'New session'}</button></div>`);
    const body = root.querySelector('#sb-body');
    const q = root.querySelector('#sb-q');

    const matches = s => {
      if (!view.query) return true;
      const hay = [s.title, s.excerpt&&s.excerpt.source, P().hostName(s.host), s.preview, ...(s.transcript||[]).map(t=>t.text)].join(' ').toLowerCase();
      return hay.includes(view.query.toLowerCase());
    };
    const rowHTML = s => {
      const badge = s.current ? `<span class="sb-badge">Current · autosaved</span>` : '';
      const titleEl = view.editingId===s.id
        ? `<input class="sb-rename" data-renameinput value="${esc(s.title)}">`
        : `<span class="sb-title">${esc(s.title)}</span>`;
      const src = s.excerpt ? s.excerpt.source : '—';
      const note = `<span class="sb-note">${ICONS.bot({size:12,sw:1.6})} memory not retained on restore</span>`;
      const delConfirm = view.confirmDel===s.id;
      const actions = delConfirm
        ? `<button class="sb-act del" data-del="${s.id}" title="Confirm delete">${ICONS.check({size:14,sw:2.2})}</button><button class="sb-act" data-delcancel title="Keep">${ICONS.x({size:13,sw:2})}</button>`
        : `<button class="sb-act" data-rename="${s.id}" title="Rename">${ICONS.pen({size:13})}</button><button class="sb-act" data-dup="${s.id}" title="Duplicate">${ICONS.copy({size:13})}</button><button class="sb-act" data-reveal="${s.id}" title="Reveal file">${ICONS.doc({size:13})}</button><button class="sb-act del" data-del="${s.id}" title="Delete">${trashIc({size:14})}</button>`;
      return `<div class="sb-row${s.current?' current':''}" data-open="${s.id}">
        <div class="sb-host">${hostChip(s.host,22)}</div>
        <div class="sb-main">
          <div class="sb-titlerow">${titleEl}${badge}</div>
          <div class="sb-meta"><span class="host">${esc(P().hostName(s.host))}</span><span class="dotsep">·</span><span>${s.turns} turns</span><span class="dotsep">·</span><span>${s.excerpt?P().fmt(s.excerpt.words)+' words':'no excerpt'}</span><span class="dotsep">·</span><span>${esc(s.rel)}</span><span class="dotsep">·</span><span class="src">${esc(src)}</span></div>
          <div class="sb-preview">${esc(s.preview)}</div>
          ${note}
        </div>
        <div class="sb-actions">${actions}</div>
        <button class="sb-open" data-openbtn="${s.id}">Open</button>
      </div>`;
    };
    const rebuild = () => {
      const shown = SESSIONS.filter(matches);
      if (!shown.length){ body.innerHTML = `<div class="sb-empty">${ICONS.search({size:22,sw:1.6})}<div>No sessions match “${esc(view.query)}”.</div></div>`; return; }
      let html = '';
      const cur = shown.find(s=>s.current);
      if (cur) html += `<div class="sb-gh first"><span class="t">Current session</span><span class="c">restores automatically</span></div>` + rowHTML(cur);
      const rest = shown.filter(s=>!s.current);
      if (view.groupBy==='date'){
        Object.keys(GROUPS).forEach(g=>{ const inG=rest.filter(s=>s.group===g); if(!inG.length) return;
          html += `<div class="sb-gh"><span class="t">${GROUPS[g]}</span><span class="c">${inG.length}</span></div>` + inG.map(rowHTML).join(''); });
      } else {
        const keys=[]; rest.forEach(s=>{ if(!keys.includes(s.key)) keys.push(s.key); });
        keys.forEach(k=>{ const inK=rest.filter(s=>s.key===k);
          html += `<div class="sb-gh"><span class="t">${esc(k)}</span><span class="c">${inK.length}</span></div>` + inK.map(rowHTML).join(''); });
      }
      body.innerHTML = html;
      if (view.editingId){ const inp=body.querySelector('[data-renameinput]'); if(inp){ inp.focus(); inp.select(); } }
    };

    const openSess = id => { const s=SESSIONS.find(x=>x.id===id); if(s){ cwClose(); P().loadSession(s); } };
    body.addEventListener('click', e=>{
      const r = a => e.target.closest('['+a+']');
      let el;
      if ((el=r('data-openbtn'))){ openSess(el.dataset.openbtn); return; }
      if ((el=r('data-rename'))){ view.editingId=el.dataset.rename; view.confirmDel=null; rebuild(); return; }
      if ((el=r('data-dup'))){ const s=SESSIONS.find(x=>x.id===el.dataset.dup); const c={...s, id:'dup-'+Date.now(), current:false, title:s.title+' (copy)', rel:'just now', group:'today'}; SESSIONS.splice(SESSIONS.indexOf(s)+1,0,c); P().toast('Duplicated — '+c.title,'copy'); rebuild(); return; }
      if ((el=r('data-reveal'))){ const s=SESSIONS.find(x=>x.id===el.dataset.reveal); P().toast('Revealed prose-minion/sessions/'+slug(s.title)+'.json','doc'); return; }
      if ((el=r('data-del'))){ const id=el.dataset.del; if(view.confirmDel===id){ SESSIONS=SESSIONS.filter(x=>x.id!==id); view.confirmDel=null; P().toast('Session deleted','check'); } else { view.confirmDel=id; } rebuild(); return; }
      if (r('data-delcancel')){ view.confirmDel=null; rebuild(); return; }
      // row body click = open (ignore when editing)
      if (!view.editingId && e.target.closest('.sb-row') && !e.target.closest('.sb-actions')){ openSess(e.target.closest('.sb-row').dataset.open); }
    });
    body.addEventListener('keydown', e=>{
      const inp = e.target.closest('[data-renameinput]'); if(!inp) return;
      if (e.key==='Enter'){ const s=SESSIONS.find(x=>x.id===view.editingId); if(s) s.title=inp.value.trim()||s.title; view.editingId=null; P().toast('Renamed','pen'); rebuild(); }
      if (e.key==='Escape'){ view.editingId=null; rebuild(); }
    });
    body.addEventListener('focusout', e=>{ const inp=e.target.closest('[data-renameinput]'); if(inp && view.editingId){ const s=SESSIONS.find(x=>x.id===view.editingId); if(s) s.title=inp.value.trim()||s.title; view.editingId=null; rebuild(); } });

    q.addEventListener('input', ()=>{ view.query=q.value; view.editingId=null; view.confirmDel=null; rebuild(); });
    root.querySelector('.sb-seg').addEventListener('click', e=>{ const b=e.target.closest('[data-grp]'); if(!b) return; view.groupBy=b.dataset.grp; root.querySelectorAll('.sb-seg button').forEach(x=>x.classList.toggle('on', x===b)); rebuild(); });
    root.querySelector('[data-newses]').addEventListener('click', ()=>{ cwClose(); P().newSession(); });

    sOpen(root, 'xwide sheet');
    rebuild();
    setTimeout(()=>q.focus(), 40);
  }

  return { renderMenu, openBrowser, openSave };
})();
window.PMSessions = PMSessions;
