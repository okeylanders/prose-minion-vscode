/* Conversation Widgets — spread logic. Needs icons.js (IC, ICONS). */
const CWX = {
  orbit: o=>IC('<circle cx="12" cy="12" r="3"/><circle cx="19" cy="5" r="2"/><circle cx="5" cy="19" r="2"/><path d="M10.4 21.9a10 10 0 0 0 9.9-15.4M13.6 2.1a10 10 0 0 0-9.9 15.4"/>',o),
  sliders: o=>IC('<line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="2" y1="14" x2="6" y2="14"/><line x1="10" y1="8" x2="14" y2="8"/><line x1="18" y1="16" x2="22" y2="16"/>',o),
  cap: o=>IC('<path d="M22 10 12 5 2 10l10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/>',o),
  eye: o=>IC('<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>',o),
};
const cwIc = (n,o)=> (ICONS[n]||CWX[n])(o||{size:15,sw:1.7});
const cwEsc = s=> s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

const CW_WIDGETS = [
  {group:'Ready now', items:[
    {id:'gesture',icon:'hand',name:'Gesture Playground',rail:'oneshot',railT:'one-shot',blurb:'One model call returns a menu of gesture directions for a phrase — keep the ones you want, commit them to the room.',tag:'Sprint 01',live:true}]},
  {group:'Committed sprints', items:[
    {id:'gravity',icon:'orbit',name:'Lexical Gravity',rail:'standing',railT:'standing',blurb:'Pull the passage’s lexis toward an interpretive lens — Photography, Mathematics, Music — with weight and reach.',tag:'Sprint 02'},
    {id:'ctrl',icon:'sliders',name:'Prose Controller',rail:'standing',railT:'standing',blurb:'How the passage is made: diction, sentence architecture, rhythm, density, figurative texture, punctuation.',tag:'Sprint 03'},
    {id:'blend',icon:'scale',name:'Gravity: Lens Blending',rail:'standing',railT:'standing',blurb:'Blend multiple lenses with explicit dominance weighting — never an unweighted average.',tag:'Sprint 04'}]},
  {group:'Concept springs', items:[
    {id:'decisions',icon:'stamp',name:'Decisions',rail:'oneshot',railT:'one-shot',blurb:'Append-only decision record; a deterministic scan assembles the running list.',tag:'concept'},
    {id:'scratch',icon:'doc',name:'Project Scratch Pad',rail:'resource',railT:'resource',blurb:'Durable project notes; each append also leaves a visible thread event.',tag:'concept'},
    {id:'learnen',icon:'cap',name:'Learner: English',rail:'oneshot',railT:'one-shot',blurb:'Lessons and drills; selected exercises commit as one-shot artifacts.',tag:'concept'},
    {id:'learncraft',icon:'book',name:'Learner: Art of the Craft',rail:'oneshot',railT:'one-shot',blurb:'The Learner shell with a storytelling-craft curriculum pack.',tag:'concept'},
    {id:'svt',icon:'eye',name:'Show vs. Tell Playground',rail:'oneshot',railT:'one-shot',blurb:'Recast a told beat as shown alternatives; keep the ones that land.',tag:'concept'}]}
];

const CW_MENU = [
  {h:'The eyes', opts:['Her gaze snagged on him a half-second too long','She blinked once, slow, like a shutter on the wrong exposure','Her eyes went somewhere he couldn’t follow']},
  {h:'The mouth, the face', opts:['The smile arrived late and left early','A smile assembled rather than felt','Her jaw loosened — not a smile, permission for one']},
  {h:'Hands & body', opts:['She turned her mug a quarter-turn, then back','Her shoulders dropped a notch when the kettle clicked','Her thumbnail found the groove in the table and stayed']},
  {h:'The reader’s read', opts:['He counted it as a win anyway','It was the smile she used on waiters','Whatever it was, it wasn’t for him']}
];
const CW_NOTES = 'Mara — guarded, recently bereaved, hates being read. She would never perform warmth for an audience.';

/* ---------- overlay ---------- */
let CW_OV = null;
function cwOverlay(){
  if(!CW_OV){
    CW_OV = document.createElement('div'); CW_OV.className='cw-ov';
    CW_OV.addEventListener('click', e=>{ if(e.target===CW_OV) cwClose(); });
    document.addEventListener('keydown', e=>{ if(e.key==='Escape') cwClose(); });
    document.body.appendChild(CW_OV);
  }
  return CW_OV;
}
function cwOpen(inner, narrow){
  const ov = cwOverlay(); ov.innerHTML='';
  const m = document.createElement('div'); m.className='cw-modal'+(narrow?' narrow':'');
  m.setAttribute('role','dialog'); m.setAttribute('aria-modal','true');
  m.appendChild(inner); ov.appendChild(m); ov.classList.add('open');
}
function cwClose(){ if(CW_OV){ CW_OV.classList.remove('open'); CW_OV.innerHTML=''; } }
function cwXBtn(){
  const b=document.createElement('button'); b.className='cw-x'; b.title='Close';
  b.innerHTML=cwIc('x',{size:13,sw:1.8}); b.addEventListener('click',cwClose); return b;
}

/* ---------- widget browser ---------- */
function buildWidgetBrowser(onPick, inModal, liveIds){
  const el=document.createElement('div'); el.className='cw-browser';
  if(inModal) el.appendChild(cwXBtn());
  el.insertAdjacentHTML('beforeend',
    `<div class="cw-eyebrow">Workshop · Composer</div><h3>Widgets</h3>
     <p class="bsub">Interactive surfaces you <b>play with before anything commits</b>. Tools run once; messages just say things; a widget is played, then committed — a visible event plus an optional shaping payload.</p>`);
  CW_WIDGETS.forEach(g=>{
    el.insertAdjacentHTML('beforeend',`<div class="cw-mgh"><span class="t">${g.group}</span><hr></div>`);
    g.items.forEach(w=>{
      const b=document.createElement('button');
      const live = liveIds ? liveIds.includes(w.id) : w.live;
      b.className='cw-brow'+(live?'':' dis');
      if(!live) b.title='Not playable in this spread — visible so the registry ships with honest state';
      b.innerHTML=`<span class="ic">${cwIc(w.icon,{size:16,sw:1.7})}</span>
        <span class="bt"><span class="nm">${w.name} <span class="cw-rail ${w.rail}">${w.railT}</span> <span class="cw-stag">${w.tag}</span></span>
        <span class="bl">${w.blurb}</span></span>`;
      if(live) b.addEventListener('click',()=>onPick(w));
      el.appendChild(b);
    });
  });
  return el;
}

/* ---------- gesture playground panel ---------- */
function buildGesturePanel(o){
  o = Object.assign({state:'input', banner:null, preselect:[], note:'', prefillNotes:false, live:true, onCommit:null}, o);
  const root = document.createElement('div'); root.className='cw-panel';
  if(o.live) root.appendChild(cwXBtn());
  const notesVal = (o.prefillNotes || o.banner==='clone') ? CW_NOTES : '';
  root.insertAdjacentHTML('beforeend', `
    <div class="cw-eyebrow">Widget <span class="cw-rail oneshot">one-shot · thread-artifact</span></div>
    <h2>${cwIc('hand',{size:17,sw:1.8})} Gesture Playground</h2>
    <p class="cw-sub">A menu of gesture directions for one phrase. Play freely — <b>nothing touches the conversation until you commit</b>.</p>
    <div class="cw-bslot"></div>
    <div class="cw-field"><div class="cw-flabel">Target phrase <span class="src">seeded from selection</span></div><input class="cw-in cw-phrase" value="she smiled"></div>
    <div class="cw-field"><div class="cw-flabel">Surrounding context <span class="src">from excerpt · kitchen scene</span></div>
      <div class="cw-ctx">…He set the mug down where her hand could reach it without asking. “You kept the houseplants alive,” he said. <mark>She smiled.</mark> “Somebody had to.”…</div></div>
    <div class="cw-field"><div class="cw-flabel">Character notes ${o.prefillNotes?'<span class="src">prefilled by Jill</span>':''}</div>
      <textarea class="cw-in cw-notes" placeholder="Who is she in this beat?">${notesVal}</textarea></div>
    <button class="cw-gen">${cwIc('sparkle',{size:14,sw:1.8})} Generate directions</button>
    <div class="cw-seam">deterministic scaffold · one model call, fast tier · commit never re-runs it</div>
    <div class="cw-menu" hidden></div>
    <div class="cw-foot">
      <span class="cw-fnote"><span class="cw-count"></span>Pre-commit play is free — only the commit pays context.</span>
      ${o.live?'<button class="cw-btn ghost cw-cancel">Cancel</button>':''}
      <button class="cw-btn primary cw-commit" disabled>${o.banner==='clone'?'Commit as new turn':'Commit to thread'}</button>
    </div>`);
  const bslot=root.querySelector('.cw-bslot');
  if(o.banner==='seed') bslot.innerHTML=`<div class="cw-banner seed">${cwIc('sparkle',{size:13,sw:1.8})}<span><b>Recommended and prefilled by Jill.</b> Everything here is editable — she set the table, you decide what commits.</span></div>`;
  if(o.banner==='clone') bslot.innerHTML=`<div class="cw-banner clone">${cwIc('refresh',{size:13,sw:1.8})}<span><b>Re-opened from a committed turn.</b> The old chip stays as history — committing again creates a <b>new</b> turn at the head. History is never rewritten.</span></div>`;
  const menu=root.querySelector('.cw-menu'), gen=root.querySelector('.cw-gen'), commit=root.querySelector('.cw-commit');
  /* menu content */
  let mh='';
  CW_MENU.forEach(g=>{
    mh+=`<div class="cw-mgh"><span class="t">${g.h}</span><hr></div>`;
    g.opts.forEach(p=>{ mh+=`<button class="cw-opt" data-p="${cwEsc(p)}"><span class="bx">${cwIc('check',{size:10,sw:3})}</span><span>${cwEsc(p)}</span></button>`; });
  });
  mh+=`<div class="cw-field"><div class="cw-flabel">Optional note to the room</div><input class="cw-in cw-note" placeholder="e.g. keep it small" value="${cwEsc(o.note)}"></div>`;
  menu.innerHTML=mh;
  const update=()=>{
    const n=menu.querySelectorAll('.cw-opt.sel').length;
    root.querySelector('.cw-count').textContent = menu.hidden?'':(n+' selected · ');
    commit.disabled = !o.live || n===0;
    if(!o.live) commit.title='Commit is live in the flow demo (§1)';
  };
  menu.addEventListener('click',e=>{ const b=e.target.closest('.cw-opt'); if(b){ b.classList.toggle('sel'); update(); } });
  const reveal=()=>{ menu.hidden=false; gen.className='cw-gen ghost'; gen.innerHTML=`${cwIc('refresh',{size:12,sw:1.8})} Regenerate`; root.querySelector('.cw-seam').remove(); update(); };
  gen.addEventListener('click',()=>{
    if(gen.classList.contains('busy')) return;
    gen.classList.add('busy'); gen.innerHTML='One fast model call…';
    setTimeout(()=>{ gen.classList.remove('busy'); if(menu.hidden) reveal(); else gen.innerHTML=`${cwIc('refresh',{size:12,sw:1.8})} Regenerate`; }, 900);
  });
  if(o.state==='menu'){
    reveal();
    [...menu.querySelectorAll('.cw-opt')].forEach(b=>{ if(o.preselect.includes(b.dataset.p)) b.classList.add('sel'); });
    update();
  }
  if(o.live){
    root.querySelector('.cw-cancel').addEventListener('click',cwClose);
    commit.addEventListener('click',()=>{
      const phrases=[...menu.querySelectorAll('.cw-opt.sel')].map(b=>b.dataset.p);
      o.onCommit && o.onCommit({phrases, note:menu.querySelector('.cw-note').value.trim()});
    });
  }
  update();
  return root;
}

/* ---------- live flow stage ---------- */
function mountWidgetFlow(id){
  const host=document.getElementById(id);
  host.innerHTML=`<div class="cw-thread"></div>
    <div class="cw-composer">
      <div class="cw-cinput">Continue with Jill…</div>
      <div class="cw-crow">
        <button class="cw-sq" title="Attach">+</button>
        <div class="cw-acts">
          <button class="cw-abtn" title="Conversation settings"><svg viewBox="0 0 16 16" width="14" height="14" fill="none"><path d="M8 1.5L14.5 8 8 14.5 1.5 8 8 1.5z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"></path></svg><b>Balanced</b><span class="sub">FULL</span></button>
          <button class="cw-abtn">${cwIc('grid',{size:14,sw:1.7})}Tools</button>
          <button class="cw-abtn cw-wbtn" title="Open a widget">${cwIc('sparkle',{size:14,sw:1.8})}Widgets</button>
          <button class="cw-send">${cwIc('send',{size:15,sw:1.6})}</button>
        </div>
      </div>
    </div>
    <div class="cw-hint">Click <b>Widgets</b> — or Jill’s chip below her message</div>`;
  const thread=host.querySelector('.cw-thread');
  const add=(who,html)=>{
    const m=document.createElement('div'); m.className='cw-msg '+who;
    m.innerHTML=(who==='jill'?`<div class="cw-who"><span class="dot"></span>Jill · persona</div>`:`<div class="cw-who">You</div>`)+`<div class="cw-body">${html}</div>`;
    thread.appendChild(m); thread.scrollTop=thread.scrollHeight; return m;
  };
  const openGesture=(opts)=> cwOpen(buildGesturePanel(Object.assign({live:true,onCommit:commitDraft},opts)));
  const openBrowser=()=> cwOpen(buildWidgetBrowser(w=>{ if(w.id==='gesture') openGesture({}); }, true), true);

  function commitDraft(d){
    cwClose();
    const m=add('you',`For <span class="cw-q">“she smiled”</span> — here are the gesture directions I want${d.note?` — <i>${cwEsc(d.note)}</i>`:''}.`);
    const wrap=document.createElement('div'); wrap.className='cw-chipwrap';
    const chip=document.createElement('button'); chip.className='cw-chip';
    chip.innerHTML=`${cwIc('hand',{size:13,sw:1.8})} Gesture Playground <span class="m">${d.phrases.length} direction${d.phrases.length>1?'s':''} · re-open</span>`;
    chip.title='Presentation-only — the model never sees this chip';
    chip.addEventListener('click',()=> openGesture({state:'menu',banner:'clone',preselect:d.phrases,note:d.note}));
    wrap.appendChild(chip); m.appendChild(wrap); thread.scrollTop=thread.scrollHeight;
    const t=document.createElement('div'); t.className='cw-msg jill';
    t.innerHTML=`<div class="cw-who"><span class="dot"></span>Jill · persona</div><div class="cw-typing"><i></i><i></i><i></i></div>`;
    setTimeout(()=>{ thread.appendChild(t); thread.scrollTop=thread.scrollHeight; },500);
    setTimeout(()=>{
      const a=d.phrases[0], b=d.phrases[1];
      let r='Took the beat again with your directions. ';
      if(a) r+=`“<i>${cwEsc(a)}</i>” carries the turn now`;
      if(b) r+=`, and it closes on “<i>${cwEsc(b)}</i>”`;
      r+='. The stated smile is gone — the reader does the reading. Want the same pass at the other two smiles on this page?';
      t.querySelector('.cw-typing').outerHTML=`<div class="cw-body">${r}</div>`;
      thread.scrollTop=thread.scrollHeight;
    },2100);
  }

  add('you','Here’s the kitchen scene again. The reunion beat still reads flat — she comes off cheerful, and she shouldn’t.');
  const j=add('jill','You’re telling the reunion instead of letting it happen — <span class="cw-q">“she smiled”</span> does three different jobs on this page, and the one by the mug is the beat that matters. Want to play with alternatives before I take another pass?');
  const reco=document.createElement('button'); reco.className='cw-reco';
  reco.innerHTML=`${cwIc('hand',{size:13,sw:1.8})} Gesture Playground <span class="m">prefilled · “she smiled”</span>`;
  reco.addEventListener('click',()=> openGesture({banner:'seed',prefillNotes:true}));
  j.querySelector('.cw-body').appendChild(reco);
  host.querySelector('.cw-wbtn').addEventListener('click',openBrowser);
  return {openGesture, openBrowser};
}

/* ---------- static frame mounts ---------- */
function mountBrowserFrame(id, openGesture){
  document.getElementById(id).appendChild(buildWidgetBrowser(w=>{ if(w.id==='gesture') openGesture({}); }, false));
}
function mountGestureFrame(id, opts){
  document.getElementById(id).appendChild(buildGesturePanel(Object.assign({live:false},opts)));
}
