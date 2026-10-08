/* Show vs. Tell Playground — Spread 04 logic. Needs icons.js + pm-widgets.js. */
const SVT_POS=[
 {n:'State it',s:'direct tell',line:'Gets the reader across the room in nine words. Spends nothing, teaches nothing.',ctrl:'summary allowed'},
 {n:'Summarize',s:'compressed narrative',line:'Buys a year in a clause — right when the beat is a bridge to somewhere else.',ctrl:'summary allowed'},
 {n:'Hinge',s:'tell the bridge, show the fulcrum',line:'Tells the year, shows the second. Usually the working answer — so distrust it once.',ctrl:'mixed'},
 {n:'Evidence',s:'observable action &amp; sense',line:'Nothing is claimed, so nothing can be argued with. The most ambiguous position, on purpose.',ctrl:'scene only'},
 {n:'Inhabit',s:'full scene time',line:'The room becomes the argument. Costs the most page of anything here.',ctrl:'scene only'}
];
const SVT_DIMS=[
 {k:'reader speed',v:[4,4,3,2,1]},{k:'fact clarity',v:[4,4,3,2,2]},
 {k:'intimacy',v:[1,1,2,3,4]},{k:'page emphasis',v:[1,2,3,3,4]},
 {k:'ambiguity',v:[0,1,2,4,3]},{k:'scene time',v:[0,1,2,3,4]},
 {k:'reader work',v:[0,1,3,4,3]}
];
const SVT_CH=[{k:'action',n:'observable action'},{k:'sense',n:'sensory evidence'},{k:'interior',n:'interiority',q:'his inference only'},{k:'dialogue',n:'dialogue / subtext'},{k:'summary',n:'summary / exposition'}];
const SVT_BUDGET=['tighter','same length','+1 sentence','+1 paragraph'];
const SVT_BEAT='She hadn\u2019t trusted him since the funeral.';
const SVT_INTENT='The distrust is old and funeral-rooted \u2014 and she never says it out loud.';
const SVT_HOLD='No flashback. Stay in the kitchen, stay in tonight.';
const SVT_GROUPS=[
 {h:'Told, cleanly',sub:'compress / explain',opts:[
  {t:'She hadn\u2019t trusted him since the funeral.',ch:'summary',
   note:'<b>Gains</b> speed, certainty, nine words. <b>Costs</b> every scrap of reader work \u2014 and the doubt that would have made her interesting.',
   dir:'keep the flat tell'},
  {t:'Since the funeral she had answered his questions and volunteered nothing.',ch:'summary',
   note:'<b>Gains</b> a whole year in one clause, and a fact the reader can carry forward. <b>Costs</b> scene time this beat was never going to get.',
   dir:'summarize the year \u2014 pattern, not incident'}]},
 {h:'Shown as evidence',sub:'observable action &amp; sense',opts:[
  {t:'She took the mug with her left hand and kept the right one on the doorframe.',ch:'action',
   note:'<b>Gains</b> deniability \u2014 nothing is claimed, so nothing can be argued with. <b>Costs</b> precision: some readers will only see a woman holding a door.',
   dir:'guard as body fact \u2014 hand, doorframe; claim nothing'},
  {t:'The kitchen smelled of lilies again. She breathed through her mouth until he sat down.',ch:'sense',
   note:'<b>Gains</b> the funeral in the room without naming it, plus the intimacy of a body under strain. <b>Costs</b> two lines, and depends on a reader who catches lilies.',
   dir:'funeral arrives by smell; her body manages it, unexplained'}]},
 {h:'Shown from inside',sub:'POV-legal \u2014 his read, not her mind',opts:[
  {t:'He had learned the pause before she answered him. Since March it had been three seconds long.',ch:'interior',
   note:'<b>Gains</b> the fact and the ache at once, and stays inside POV \u2014 his measurement of her, not her interior. <b>Costs</b> a narrator who now admits he is counting.',
   dir:'his inference \u2014 what he has learned to measure in her'},
  {t:'\u201CAsk me the real question,\u201D she said.\n\u201CI don\u2019t have a real question.\u201D\n\u201CYou never do. Not since March.\u201D',ch:'dialogue',
   note:'<b>Gains</b> her voice instead of his summary, and a move in a game they are both playing. <b>Costs</b> control: subtext reads as banter if the beats around it are warm.',
   dir:'subtext in dialogue \u2014 she names the month, not the feeling'}]},
 {h:'Mixed \u2014 tell the bridge, show the fulcrum',sub:'the hinge',opts:[
  {t:'Since the funeral she had volunteered nothing. Tonight she took the mug with her left hand and left the right one on the doorframe.',ch:'summary + action',
   note:'<b>Gains</b> both budgets: tells the year, shows the second that matters. <b>Costs</b> almost nothing \u2014 which is why it is usually the working answer, and why it is worth distrusting once.',
   dir:'tell the year, show tonight \u2014 summary then scene'}]}
];
const SVT_CEIL=600;
const svtW=t=> t.trim().split(/\s+/).length;
const svtFlat=()=> SVT_GROUPS.flatMap(g=>g.opts);

function buildSvtPanel(o){
  o=Object.assign({state:'input',pos:2,banner:null,preselect:[],carry:{},note:'',budget:1,channels:['action','sense'],live:true,onCommit:null},o);
  let pos=o.pos, budget=o.budget;
  const chans=new Set(o.channels), sel=new Map();
  const root=document.createElement('div'); root.className='cw-panel svt-wide';
  if(o.live) root.appendChild(cwXBtn());
  root.insertAdjacentHTML('beforeend',`
    <div class="cw-eyebrow">Widget <span class="cw-rail oneshot">one-shot · thread-artifact</span> <span class="cw-stag">concept spring</span></div>
    <h2>${cwIc('eye',{size:17,sw:1.8})} Show vs. Tell Playground</h2>
    <p class="cw-sub">Move one beat along the continuum from <b>compressed explanation</b> to <b>embodied dramatization</b>, see what each version gains and costs, and hand the useful directions back to the room. <b>Both ends are tools</b> — nothing here calls telling bad writing.</p>
    <div class="cw-bslot"></div>
    <div class="cw-field"><div class="cw-flabel">Selected beat <span class="src">seeded from selection</span> <span class="svt-pov">POV: close third · his</span></div>
      <input class="cw-in svt-beat" value="${SVT_BEAT}"></div>
    <div class="svt-body">
      <div class="l">
        <div class="cw-field"><div class="cw-flabel">Surrounding passage <span class="src">from excerpt · kitchen scene</span></div>
          <div class="cw-ctx">…He set the mug down where her hand could reach it without asking. <mark>She hadn\u2019t trusted him since the funeral.</mark> \u201CYou kept the houseplants alive,\u201D he said.…</div></div>
        <div class="cw-field"><div class="cw-flabel">Must survive every variation</div>
          <textarea class="cw-in svt-intent">${SVT_INTENT}</textarea></div>
        <div class="cw-field"><div class="cw-flabel">Must <i>not</i> change <span class="src">optional</span></div>
          <input class="cw-in svt-hold" value="${SVT_HOLD}"></div>
      </div>
      <div class="r">
        <div class="cw-field"><div class="cw-flabel">Channels to emphasize</div><div class="svt-chs"></div>
          <p class="svt-hint"><b>POV constraint:</b> the passage is close third on him, so <i>interiority</i> can only be his inference about her — never her mind. The generation is told this.</p></div>
        <div class="cw-field"><div class="cw-flabel">Length budget</div><div class="svt-chs bud"></div></div>
      </div>
    </div>
    <div class="svt-cont">
      <div class="svt-ends"><span>compress / explain</span><span>dramatize / embody</span></div>
      <div class="svt-steps"></div>
      <p class="svt-line"></p>
      <div class="svt-tr"></div>
      <p class="svt-trcap">deterministic tradeoff readout · no model call · no bar is a score</p>
      <div class="svt-ctrl"></div>
    </div>
    <button class="cw-gen">${cwIc('sparkle',{size:14,sw:1.8})} Generate the workup</button>
    <div class="cw-seam">everything above is deterministic scaffold · one model call, fast tier · commit never re-runs it</div>
    <div class="svt-menu" hidden></div>
    <div class="cw-foot">
      <span class="cw-fnote"><span class="cw-count"></span>Nothing is inserted into the editor — commit hands directions to the room.</span>
      ${o.live?'<button class="cw-btn ghost svt-cancel">Cancel</button>':''}
      <button class="cw-btn primary svt-commit" disabled>${o.banner==='clone'?'Commit as new turn':'Commit to thread'}</button>
    </div>`);
  const bslot=root.querySelector('.cw-bslot');
  if(o.banner==='seed') bslot.innerHTML=`<div class="cw-banner seed">${cwIc('sparkle',{size:13,sw:1.8})}<span><b>Recommended and prefilled by Jill.</b> She spotted a told beat worth testing — she proposes and prefills, you decide what commits.</span></div>`;
  if(o.banner==='clone') bslot.innerHTML=`<div class="cw-banner clone">${cwIc('refresh',{size:13,sw:1.8})}<span><b>Re-opened from a committed turn.</b> The old chip stays as history — committing again creates a <b>new</b> turn at the head.</span></div>`;
  if(o.banner==='learner') bslot.innerHTML=`<div class="cw-banner clone">${cwIc('book',{size:13,sw:1.8})}<span><b>Launched from Learner — The Storytelling Craft.</b> The lesson taught the distinction; the playground is where you spend it. Same vocabulary, different lifetime.</span></div>`;
  const chs=root.querySelector('.svt-chs'), bud=root.querySelector('.svt-chs.bud'),
        steps=root.querySelector('.svt-steps'), lineEl=root.querySelector('.svt-line'),
        trEl=root.querySelector('.svt-tr'), ctrlEl=root.querySelector('.svt-ctrl'),
        menu=root.querySelector('.svt-menu'), gen=root.querySelector('.cw-gen'),
        commit=root.querySelector('.svt-commit');

  const renderChs=()=>{
    chs.innerHTML=SVT_CH.map(c=>`<button class="svt-ch${chans.has(c.k)?' on':''}" data-ch="${c.k}">${c.n}${c.q?`<span class="q">${c.q}</span>`:''}</button>`).join('');
    bud.innerHTML=SVT_BUDGET.map((b,i)=>`<button class="svt-ch${i===budget?' on':''}" data-bud="${i}">${b}</button>`).join('');
  };
  const renderCont=()=>{
    steps.innerHTML=SVT_POS.map((p,i)=>`<button class="svt-step${i===pos?' on':''}" data-pos="${i}"><span class="n">${p.n}</span><span class="s">${p.s}</span></button>`).join('');
    lineEl.textContent=SVT_POS[pos].line;
    trEl.innerHTML=SVT_DIMS.map(d=>`<div class="svt-trow"><span class="lb">${d.k}</span><span class="svt-bars">${[0,1,2,3].map(i=>`<i class="${i<d.v[pos]?'on':''}"></i>`).join('')}</span></div>`).join('');
    ctrlEl.innerHTML=`shared vocabulary → Prose Controller ch. 06 <i>narrative handling</i> · show : tell = <b>${SVT_POS[pos].ctrl}</b>`;
  };
  chs.addEventListener('click',e=>{ const b=e.target.closest('[data-ch]'); if(!b) return;
    const k=b.dataset.ch; if(chans.has(k)){ if(chans.size>1) chans.delete(k); } else chans.add(k); renderChs(); });
  bud.addEventListener('click',e=>{ const b=e.target.closest('[data-bud]'); if(!b) return; budget=+b.dataset.bud; renderChs(); });
  steps.addEventListener('click',e=>{ const b=e.target.closest('[data-pos]'); if(!b) return; pos=+b.dataset.pos; renderCont(); });

  /* --- workup --- */
  let mh='';
  SVT_GROUPS.forEach((g,gi)=>{
    mh+=`<div class="cw-mgh"><span class="t">${g.h}</span><hr><span class="t" style="color:var(--faint);letter-spacing:.06em">${g.sub}</span></div>`;
    g.opts.forEach((op,oi)=>{
      const id=gi+'-'+oi;
      mh+=`<div class="svt-alt" data-id="${id}"><div class="top"><span class="bx">${cwIc('check',{size:10,sw:3})}</span>
        <span class="tx">${cwEsc(op.t)}</span><span class="w">${svtW(op.t)} w</span></div>
        <p class="note">${op.note}</p>
        <div class="svt-carry"><span class="cap">commit as</span><button data-carry="prose">prose variant</button><button data-carry="dir">direction only</button></div></div>`;
    });
  });
  mh+=`<div class="cw-field"><div class="cw-flabel">Note to the room <span class="src">optional</span></div><input class="cw-in svt-note" placeholder="e.g. the tell can stay if the fulcrum is shown" value="${cwEsc(o.note)}"></div>
    <div class="svt-payload"><div class="cap"><span>What commits</span><span class="ceil"></span></div><div class="svt-pl"></div><div class="svt-meter"><i style="width:0"></i></div></div>`;
  menu.innerHTML=mh;
  const flat=svtFlat();
  const idOf=t=>{ let r=null; SVT_GROUPS.forEach((g,gi)=>g.opts.forEach((op,oi)=>{ if(op.t===t) r=gi+'-'+oi; })); return r; };
  const optOf=id=>{ const [g,i]=id.split('-'); return SVT_GROUPS[+g].opts[+i]; };

  const renderPayload=()=>{
    const pl=root.querySelector('.svt-pl'), ceil=root.querySelector('.ceil'), meter=root.querySelector('.svt-meter');
    const note=(menu.querySelector('.svt-note')||{}).value||'';
    if(!sel.size){ pl.innerHTML='<span class="none">nothing kept yet — commit stays off</span>'; ceil.textContent=''; meter.classList.remove('over'); meter.firstElementChild.style.width='0'; commit.disabled=true; return; }
    let lines=[`<span class="k">beat:</span> \u201C${cwEsc(SVT_BEAT)}\u201D`,`<span class="k">position:</span> ${SVT_POS[pos].n.toLowerCase()} · ${SVT_POS[pos].s.replace('&amp;','&')}`,`<span class="k">must survive:</span> ${cwEsc(SVT_INTENT)}`];
    let plain=[SVT_BEAT,SVT_POS[pos].n,SVT_INTENT].join(' ');
    [...sel.entries()].forEach(([id,mode])=>{
      const op=optOf(id);
      const txt = mode==='dir' ? op.dir : '\u201C'+op.t.replace(/\n/g,' / ')+'\u201D';
      lines.push(`<span class="d">·</span> ${cwEsc(txt)}`); plain+=' '+txt;
    });
    if(note){ lines.push(`<span class="k">note:</span> ${cwEsc(note)}`); plain+=' '+note; }
    pl.innerHTML=lines.join('\n');
    const n=plain.length, over=n>SVT_CEIL;
    ceil.textContent=`${n} / ${SVT_CEIL} chars`; ceil.classList.toggle('over',over);
    meter.classList.toggle('over',over); meter.firstElementChild.style.width=Math.min(100,n/SVT_CEIL*100)+'%';
    commit.disabled=!o.live;
    if(!o.live) commit.title='Commit is live in the flow demo (§1)';
  };
  const update=()=>{
    root.querySelector('.cw-count').textContent = menu.hidden?'':(sel.size?sel.size+' kept · ':'');
    menu.querySelectorAll('.svt-alt').forEach(el=>{
      const m=sel.get(el.dataset.id);
      el.classList.toggle('sel',!!m);
      el.querySelectorAll('[data-carry]').forEach(b=>b.classList.toggle('on',b.dataset.carry===(m||'prose')));
    });
    renderPayload();
  };
  menu.addEventListener('click',e=>{
    const cb=e.target.closest('[data-carry]');
    if(cb){ const el=cb.closest('.svt-alt'); if(sel.has(el.dataset.id)) sel.set(el.dataset.id,cb.dataset.carry); update(); return; }
    const alt=e.target.closest('.svt-alt');
    if(alt){ const id=alt.dataset.id; sel.has(id)?sel.delete(id):sel.set(id,o.carry[id]||'prose'); update(); }
  });
  menu.addEventListener('input',e=>{ if(e.target.classList.contains('svt-note')) renderPayload(); });

  const reveal=()=>{ menu.hidden=false; gen.className='cw-gen ghost'; gen.innerHTML=`${cwIc('refresh',{size:12,sw:1.8})} Regenerate the workup`; const s=root.querySelector('.cw-seam'); if(s) s.remove(); update(); };
  gen.addEventListener('click',()=>{
    if(gen.classList.contains('busy')) return;
    gen.classList.add('busy'); gen.innerHTML='One fast model call…';
    setTimeout(()=>{ gen.classList.remove('busy'); if(menu.hidden) reveal(); else gen.innerHTML=`${cwIc('refresh',{size:12,sw:1.8})} Regenerate the workup`; },950);
  });
  if(o.state==='menu'){
    o.preselect.forEach(t=>{ const id=idOf(t); if(id) sel.set(id,o.carry[id]||o.carry[t]||'prose'); });
    reveal();
  }
  if(o.live){
    root.querySelector('.svt-cancel').addEventListener('click',cwClose);
    commit.addEventListener('click',()=>{
      const items=[...sel.entries()].map(([id,mode])=>({t:optOf(id).t,mode,dir:optOf(id).dir}));
      const carry={}; sel.forEach((m,id)=>carry[id]=m);
      o.onCommit && o.onCommit({items,carry,pos,note:(menu.querySelector('.svt-note').value||'').trim()});
    });
  }
  renderChs(); renderCont(); update();
  return root;
}

/* ---------- live flow ---------- */
function mountSvtFlow(id){
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
    <div class="cw-hint">Click <b>Widgets</b> — or Jill\u2019s chip below her message</div>`;
  const thread=host.querySelector('.cw-thread');
  const add=(who,html)=>{
    const m=document.createElement('div'); m.className='cw-msg '+who;
    m.innerHTML=(who==='jill'?`<div class="cw-who"><span class="dot"></span>Jill · persona</div>`:`<div class="cw-who">You</div>`)+`<div class="cw-body">${html}</div>`;
    thread.appendChild(m); thread.scrollTop=thread.scrollHeight; return m;
  };
  const open=opts=> cwOpen(buildSvtPanel(Object.assign({live:true,onCommit:commitDraft},opts)));
  const openBrowser=()=> cwOpen(buildWidgetBrowser(w=>{ if(w.id==='svt') open({}); },true,['svt']),true);

  function commitDraft(d){
    cwClose();
    const kept=d.items.length, dirs=d.items.filter(i=>i.mode==='dir').length;
    const m=add('you',`Ran the funeral line through the playground at <span class="cw-q">${SVT_POS[d.pos].n.toLowerCase()}</span> — here\u2019s how I want the beat carried${d.note?` — <i>${cwEsc(d.note)}</i>`:''}.`);
    const wrap=document.createElement('div'); wrap.className='cw-chipwrap';
    const chip=document.createElement('button'); chip.className='cw-chip';
    chip.innerHTML=`${cwIc('eye',{size:13,sw:1.8})} Show vs. Tell <span class="m">${kept} kept${dirs?` · ${dirs} as direction`:''} · re-open</span>`;
    chip.title='Presentation-only — the model never sees this chip';
    chip.addEventListener('click',()=> open({state:'menu',banner:'clone',pos:d.pos,preselect:d.items.map(i=>i.t),carry:d.carry,note:d.note}));
    wrap.appendChild(chip); m.appendChild(wrap); thread.scrollTop=thread.scrollHeight;
    const t=document.createElement('div'); t.className='cw-msg jill';
    t.innerHTML=`<div class="cw-who"><span class="dot"></span>Jill · persona</div><div class="cw-typing"><i></i><i></i><i></i></div>`;
    setTimeout(()=>{ thread.appendChild(t); thread.scrollTop=thread.scrollHeight; },500);
    setTimeout(()=>{
      const first=d.items[0];
      let r='Took the beat again with those. ';
      if(first) r+=`Kept the fact, dropped the claim:<div class="lg-quote">${cwEsc(first.mode==='dir'?'Since the funeral she had volunteered nothing. Tonight she took the mug with her left hand and left the right one on the doorframe.':first.t.replace(/\n/g,' — '))}</div>`;
      r+='The distrust is still in the paragraph; nobody says it. Want me to run the two other told beats on this page the same way?';
      t.querySelector('.cw-typing').outerHTML=`<div class="cw-body">${r}</div>`;
      thread.scrollTop=thread.scrollHeight;
    },2100);
  }

  add('you','I keep writing sentences like <span class="cw-q">\u201Cshe hadn\u2019t trusted him since the funeral\u201D</span> and then hating them a day later.');
  const j=add('jill','It isn\u2019t a bad sentence — it\u2019s <span class="cw-q">a choice you haven\u2019t made yet</span>. That line buys you a year in nine words, which is exactly right if the beat is a bridge and exactly wrong if it\u2019s the destination. Want to see the same fact at five distances before I take another pass?');
  const reco=document.createElement('button'); reco.className='cw-reco';
  reco.innerHTML=`${cwIc('eye',{size:13,sw:1.8})} Show vs. Tell Playground <span class="m">prefilled · the funeral line</span>`;
  reco.addEventListener('click',()=> open({banner:'seed',pos:2}));
  j.querySelector('.cw-body').appendChild(reco);
  host.querySelector('.cw-wbtn').addEventListener('click',openBrowser);
  return {open,openBrowser};
}

function mountSvtFrame(id,opts){
  document.getElementById(id).appendChild(buildSvtPanel(Object.assign({live:false},opts)));
}
