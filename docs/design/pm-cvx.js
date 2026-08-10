/* Creative Variations Explorer — Spread 07 logic. Needs icons.js + pm-widgets.js. */
const CVX_PASSAGE='He set the mug down where her hand could reach it without asking. She hadn\u2019t trusted him since the funeral. \u201CYou kept the houseplants alive,\u201D he said. She smiled. \u201CSomebody had to.\u201D';
const CVX_SURVIVE='The distrust is old and funeral-rooted. She never says it out loud. The mug is offered, never handed.';
const CVX_HOLD='Stay in the kitchen, stay in tonight. No flashback. Her last line stays \u201CSomebody had to.\u201D';
const CVX_CEIL=700;

const CVX_DIST=[
 {n:'Familiar',s:'p \u2248 0.6',line:'The moves most editors reach for first. Worth generating as a baseline \u2014 sometimes the conventional choice is genuinely best, and the rest of the workup should have to beat it.'},
 {n:'Adjacent',s:'p \u2248 0.3',line:'Competent alternatives from a different angle. Safe to paste into the draft; unlikely to teach you anything you didn\u2019t already know about the beat.'},
 {n:'Tail',s:'p < 0.10',line:'The less-common tenth \u2014 what a skilled reader would not immediately expect. The default, and the reason this widget exists rather than a Regenerate button.'},
 {n:'Far tail',s:'p < 0.02',line:'Deliberately unlikely. Expect one of these to be unusable, and expect it to be worth reading anyway \u2014 the unusable one usually names the thing the passage is avoiding.'}
];
const CVX_DIMS=[
 {k:'pressure',n:'Pressure',o:['anticipatory','relational','identity','physical','none \u2014 let it sit']},
 {k:'distance',n:'Narrative distance',o:['reportorial','over the shoulder','deep interior','retrospective']},
 {k:'channel',n:'Carried by',o:['object & prop','body & choreography','dialogue & pause','sensory bleed','syntax & rhythm']},
 {k:'commit',n:'Commitment',o:['withheld','glancing','declared','overcommitted on purpose']}
];
const CVX_BOUND_DEF={pressure:'relational',distance:'over the shoulder',channel:'dialogue & pause',commit:'withheld'};

const CVX_OPEN=[
 {id:'o1',nm:'Baseline \u2014 the competent fix',tag:'familiar',keep:true,dist:.41,
  t:'He set the mug down where her hand could reach it without asking. \u201CYou kept the houseplants alive,\u201D he said. Her mouth moved, not quite a smile. \u201CSomebody had to.\u201D',
  tr:'<b>Gains</b> the obvious win \u2014 the stated smile goes, the distrust line goes, nothing else is risked. <b>Costs</b> nothing, which is the problem: it is the version four other writers would hand you.',
  dir:'cut the told line, downgrade the smile \u2014 baseline'},
 {id:'o2',nm:'Prop as narrator',tag:'tail',dist:.81,
  t:'The mug went down inside her reach, handle turned out. The kettle ticked as it cooled. Between them the table held a bowl of keys, two coasters and a year. \u201CYou kept the houseplants alive.\u201D The lilies had been the funeral\u2019s. The spider plant was hers. \u201CSomebody had to.\u201D',
  tr:'<b>Gains</b> a room that does the accounting \u2014 <i>and a year</i> in a list is the whole distrust, unclaimed. <b>Costs</b> her as an agent; a reader who wants her face will feel held off.',
  dir:'let the props keep the ledger \u2014 mug, kettle, the year on the table'},
 {id:'o3',nm:'Her refusal, timed',tag:'tail',dist:.76,
  t:'\u201CYou kept the houseplants alive.\u201D\nShe let it sit long enough that he heard the kettle.\n\u201CSomebody had to.\u201D\nHe had put the mug inside her reach so she would not have to ask. She had not touched it. She was not going to touch it while he was watching.',
  tr:'<b>Gains</b> the distrust as an <i>event</i> \u2014 it happens in real time, in a pause and an untouched mug, and the reader times it themselves. <b>Costs</b> the funeral, which leaves the paragraph entirely and must be carried by the page before.',
  dir:'stage the distrust as a pause and an untouched mug'},
 {id:'o4',nm:'Absence as furniture',tag:'far tail',dist:.88,
  flag:{k:'fact',t:'adds a fact \u2014 the chair'},
  t:'Two mugs on the counter, one of them dry since March. The chair at the end of the table had been pulled out and left pulled out, and neither of them had ever pushed it in. \u201CYou kept the houseplants alive,\u201D he said, to the room as much as to her. \u201CSomebody had to.\u201D',
  tr:'<b>Gains</b> the loss as furniture \u2014 structural, load-bearing, never stated, and it will pay again every time the kitchen appears. <b>Costs</b> a fact you did not have: this invents a chair, and the guard says so.',
  dir:'make the loss structural \u2014 an object nobody has moved since'},
 {id:'o5',nm:'Flattened register',tag:'far tail',dist:.84,
  flag:{k:'reg',t:'register drift \u2014 narrator turns clinical'},
  t:'He put the mug within reach. Distance: an arm. She had not trusted him since the eleventh of February, which was the funeral, which was the last day either of them had said the word out loud. \u201CYou kept the houseplants alive.\u201D \u201CSomebody had to.\u201D',
  tr:'<b>Gains</b> flatness that reads as damage \u2014 the date is crueller than the word grief, and the triple <i>which was</i> is a man reciting to stay upright. <b>Costs</b> the narrator\u2019s ordinary voice for four sentences; if the chapter never does this again it will read as a glitch.',
  dir:'flatten the narrator \u2014 dates and measurements instead of feeling'},
 {id:'o6',nm:'Objects, again',tag:'tail',dist:.14,dup:'o2',
  t:'He put the mug down where she could reach it. The kettle ticked as it cooled. The table between them held keys, two coasters and a year of not saying it. \u201CYou kept the houseplants alive.\u201D \u201CSomebody had to.\u201D',
  tr:'<b>Gains</b> \u2014 nothing the second card did not already buy. <b>Costs</b> a slot: this is the same move with the nouns shuffled.',
  dir:'let the props keep the ledger'}
];
const CVX_BOUNDV=[
 {id:'b1',nm:'Withheld, over the shoulder',dist:.74,
  fr:['relational','over the shoulder','dialogue & pause','withheld'],
  t:'\u201CYou kept the houseplants alive.\u201D\nHe watched her decide whether that was a question.\n\u201CSomebody had to.\u201D\nThe mug sat where he had put it, inside her reach, and he made himself stop looking at it. Three seconds, he thought. It used to be none.',
  tr:'<b>Gains</b> the distrust as a duration <i>he</i> is measuring \u2014 POV-legal, and she stays opaque. <b>Costs</b> the funeral, which is now entirely off-page.',
  dir:'his measurement of her pause \u2014 withheld, no claim'},
 {id:'b2',nm:'Overcommitted inventory',dist:.86,
  fr:['identity','reportorial','object & prop','overcommitted on purpose'],
  flag:{k:'reg',t:'narrator asserts \u2014 by design'},
  t:'He set the mug down inside her reach: white, chipped at the lip, hers since the year they moved. The lilies on the sill were the funeral\u2019s and still had not been thrown out. Everything in this room had been chosen by two people and one of them had stopped voting. \u201CYou kept the houseplants alive.\u201D \u201CSomebody had to.\u201D',
  tr:'<b>Gains</b> an inventory that does the grief, then a last clause that commits harder than the passage ever has. <b>Costs</b> a narrator with an opinion \u2014 <i>stopped voting</i> reads as the author being clever unless the page has earned that voice.',
  dir:'inventory the room, then overcommit once in the last clause'},
 {id:'b3',nm:'One sentence, glancing',dist:.69,
  fr:['none \u2014 let it sit','deep interior','syntax & rhythm','glancing'],
  t:'He set the mug down where her hand could reach it without asking, which was the whole of what he could do, and he did it the way he did everything now \u2014 early, quietly, and without being thanked. \u201CYou kept the houseplants alive.\u201D A small sound from her. \u201CSomebody had to.\u201D',
  tr:'<b>Gains</b> one long accommodating sentence that enacts the accommodation, and <i>a small sound</i> doing the smile\u2019s work without naming it. <b>Costs</b> visible distrust \u2014 this version trusts the reader more than the chapter may be able to afford.',
  dir:'one long sentence of accommodation; the smile becomes a sound'}
];
const cvxW=t=>t.trim().split(/\s+/).length;
const cvxAll=()=>CVX_OPEN.concat(CVX_BOUNDV);
const cvxOf=id=>cvxAll().find(v=>v.id===id);

function buildCvxPanel(o){
  o=Object.assign({state:'input',mode:'open',dist:2,count:5,dup:false,banner:null,preselect:[],carry:{},note:'',compare:false,live:true,onCommit:null},o);
  let mode=o.mode, dist=o.dist, count=o.count, dup=o.dup, cmp=o.compare;
  const bound=Object.assign({},CVX_BOUND_DEF);
  const pasted=o.banner==='paste';
  const sel=new Map(), okFlags=new Set();
  const root=document.createElement('div'); root.className='cw-panel cvx-wide';
  if(o.live) root.appendChild(cwXBtn());
  root.insertAdjacentHTML('beforeend',`
    <div class="cw-eyebrow">Widget <span class="cw-rail oneshot">one-shot · thread-artifact</span> <span class="cw-stag">concept spring</span></div>
    <h2>${cwIc('branch',{size:17,sw:1.8})} Creative Variations Explorer</h2>
    <p class="cw-sub">Several genuinely different takes on the same passage, under constraints <b>you</b> declare. It is a <b>comparison studio, not a rewrite button</b> — the workup is thrown away, and what commits is the direction you chose.</p>
    <div class="cw-bslot"></div>
    <div class="cvx-body">
      <div class="l">
        <div class="cw-field"><div class="cw-flabel">${pasted?'Pasted passage':'Selected passage'} ${pasted?'<span class="cvx-src warn">pasted · no surrounding passage</span>':'<span class="cvx-src">from excerpt · kitchen scene</span>'} <span class="cvx-pov">POV: close third · his</span></div>
          <textarea class="cw-in cvx-pass">${CVX_PASSAGE}</textarea>
          <p class="cvx-line" style="font-style:normal;font-size:10.5px;color:var(--faint);margin-top:6px">${pasted?'No excerpt is on the desk, so the generation sees this text and your invariants and nothing else — it cannot check continuity against the pages around it, and it will not claim to. Declare the POV and the invariants yourself.':'Surrounding passage is on the desk, so the generation can see what comes before and after. Pasted text is allowed — the widget then labels the missing context instead of pretending to it.'}</p></div>
      </div>
      <div class="r">
        <div class="cw-field"><div class="cw-flabel">Must survive every variation</div>
          <textarea class="cw-in cvx-surv">${CVX_SURVIVE}</textarea></div>
        <div class="cw-field"><div class="cw-flabel">Must <i>not</i> change <span class="src">optional</span></div>
          <textarea class="cw-in cvx-hold">${CVX_HOLD}</textarea></div>
      </div>
    </div>
    <div class="cvx-modes">
      <button class="cvx-mode" data-mode="open"><span class="n">Open sampling</span><span class="s">one dial · how far into the tail</span></button>
      <button class="cvx-mode" data-mode="bound"><span class="n">Bound frame</span><span class="s">four menus · every variation obeys them</span></button>
    </div>
    <div class="cvx-pane"></div>
    <button class="cw-gen">${cwIc('sparkle',{size:14,sw:1.8})} Generate the workup</button>
    <div class="cw-seam">everything above is deterministic scaffold · one model call, one closed schema · commit never re-runs it</div>
    <div class="cvx-menu" hidden></div>
    <div class="cw-foot">
      <span class="cw-fnote"><span class="cw-count"></span>Nothing is applied to the draft — commit hands the room your chosen directions.</span>
      ${o.live?'<button class="cw-btn ghost cvx-cancel">Cancel</button>':''}
      <button class="cw-btn primary cvx-commit" disabled>${o.banner==='clone'?'Commit as new turn':'Commit to thread'}</button>
    </div>`);
  const bslot=root.querySelector('.cw-bslot');
  if(o.banner==='seed') bslot.innerHTML=`<div class="cw-banner seed">${cwIc('sparkle',{size:13,sw:1.8})}<span><b>Recommended and prefilled by Jill.</b> She proposed the passage and the invariants — she cannot generate, select or commit for you.</span></div>`;
  if(o.banner==='clone') bslot.innerHTML=`<div class="cw-banner clone">${cwIc('refresh',{size:13,sw:1.8})}<span><b>Re-opened from a committed turn.</b> The old chip stays as history — committing again creates a <b>new</b> turn at the head.</span></div>`;
  if(o.banner==='report') bslot.innerHTML=`<div class="cw-banner clone">${cwIc('doc',{size:13,sw:1.8})}<span><b>Prefilled from a Choreography report.</b> The report found the repetition; it hands over the passage, the invariants and a suggested frame rather than growing its own variation UI.</span></div>`;
  if(o.banner==='paste') bslot.innerHTML=`<div class="cw-banner clone">${cwIc('doc',{size:13,sw:1.8})}<span><b>Pasted text — no passage context.</b> The generation sees the selection and your invariants only. It cannot check continuity against what comes before, and it will not claim to.</span></div>`;

  const pane=root.querySelector('.cvx-pane'), menu=root.querySelector('.cvx-menu'),
        gen=root.querySelector('.cw-gen'), commit=root.querySelector('.cvx-commit');

  const renderModes=()=>root.querySelectorAll('.cvx-mode').forEach(b=>b.classList.toggle('on',b.dataset.mode===mode));
  const countRow=()=>`<div class="cvx-count"><span class="cap">How many</span>${[3,4,5].map(n=>`<button data-count="${n}"${n===count?' class="on"':''}>${n}</button>`).join('')}<span class="cap" style="margin-left:6px;color:var(--faint);letter-spacing:.04em;text-transform:none">bounded three to five — a cloud is not a comparison</span></div>`;
  const renderPane=()=>{
    if(mode==='open'){
      pane.innerHTML=`<div class="cvx-ends"><span>the expected choice</span><span>the tenth nobody reaches for</span></div>
        <div class="cvx-steps">${CVX_DIST.map((d,i)=>`<button class="cvx-step${i===dist?' on':''}" data-dist="${i}"><span class="n">${d.n}</span><span class="s">${d.s}</span></button>`).join('')}</div>
        <p class="cvx-line">${CVX_DIST[dist].line}</p>
        ${countRow()}
        <div class="cvx-vs"><b>How this is actually done:</b> the distance is <i>verbalized</i> — it becomes instruction language in the prompt, not a <code>temperature</code> value. Sampling parameters move every token, including the ones holding POV, tense and grammar together; naming the target in words moves the <b>content</b> choices and leaves the structure alone. The claim is checked, not trusted: the distinctness readout under the workup is measured after the fact.</div>`;
    } else {
      pane.innerHTML=`<div class="cvx-dims">${CVX_DIMS.map(d=>`<div class="cvx-dim"><div class="h">${d.n}</div><div class="cvx-opts">${d.o.map(x=>`<button class="cvx-opt${bound[d.k]===x?' on':''}" data-dim="${d.k}" data-val="${cwEsc(x)}">${x}</button>`).join('')}</div></div>`).join('')}</div>
        ${countRow()}
        <div class="cvx-frame">every variation must be <b>${bound.pressure}</b> pressure · <b>${bound.distance}</b> · carried by <b>${bound.channel}</b> · <b>${bound.commit}</b><br><span style="color:var(--faint);font-size:9.5px">the frame is stated back on each card, so a variation you like is a combination you can ask for again</span></div>`;
    }
  };
  pane.addEventListener('click',e=>{
    const d=e.target.closest('[data-dist]'); if(d){ dist=+d.dataset.dist; renderPane(); return; }
    const c=e.target.closest('[data-count]'); if(c){ count=+c.dataset.count; renderPane(); return; }
    const b=e.target.closest('[data-dim]'); if(b){ bound[b.dataset.dim]=b.dataset.val; renderPane(); }
  });
  root.querySelector('.cvx-modes').addEventListener('click',e=>{
    const b=e.target.closest('[data-mode]'); if(!b||b.dataset.mode===mode) return;
    mode=b.dataset.mode; sel.clear(); cmp=false; menu.hidden=true;
    gen.className='cw-gen'; gen.innerHTML=`${cwIc('sparkle',{size:14,sw:1.8})} Generate the workup`;
    renderModes(); renderPane(); update();
  });

  /* ---------- workup ---------- */
  const list=()=>{
    if(mode==='bound') return CVX_BOUNDV;
    const base=CVX_OPEN.filter(v=>v.id!=='o6').slice(0,count);
    return dup ? base.slice(0,3).concat(CVX_OPEN.filter(v=>v.id==='o6')) : base;
  };
  const cardHtml=v=>{
    const tags = v.fr ? v.fr.map(f=>`<span class="tag b">${f}</span>`).join('') : `<span class="tag">${v.tag}</span>`;
    return `<div class="cvx-card" data-id="${v.id}">
      <div class="hd"><span class="bx">${cwIc('check',{size:10,sw:3})}</span><span class="nm">${v.nm}</span>${tags}<span class="w">${cvxW(v.t)} w</span></div>
      <div class="tx">${cwEsc(v.t)}</div>
      <p class="tr">${v.tr}</p>
      <div class="ft"><span class="cvx-dist${v.dist<.5?' lo':''}">distinct ${v.dist.toFixed(2)}</span>
        ${v.flag?`<button class="cvx-flag" data-flag="${v.id}">${cwIc('x',{size:9,sw:2.6})} ${v.flag.t}</button>`:''}
        <span class="cvx-carry"><span class="cap">commit as</span><button data-carry="prose">prose</button><button data-carry="dir">direction only</button></span></div></div>`;
  };
  const renderMenu=()=>{
    const vs=list(), div=Math.round(vs.reduce((a,v)=>a+v.dist,0)/vs.length*100);
    menu.innerHTML=`<div class="cvx-div"><span class="lb">set distinctness</span><span class="bar"><i style="width:${div}%"></i></span><span class="v">${(div/100).toFixed(2)}</span><span class="det">deterministic · measured after generation</span></div>
      ${dup?`<div class="cvx-warn">${cwIc('refresh',{size:14,sw:1.8})}<span class="gr"><b>Two cards collapsed.</b> <i>Prop as narrator</i> and <i>Objects, again</i> are 86% similar — the sampler produced one idea twice. Regenerating the pair costs one small call; the other three stay exactly as they are.</span><button data-regen="1">Regenerate the pair</button></div>`:''}
      <div class="cw-mgh"><span class="t">${mode==='bound'?'Under your frame':'Sampled at '+CVX_DIST[dist].n.toLowerCase()}</span><hr><span class="t" style="color:var(--faint);letter-spacing:.06em">${vs.length} returned · none ranked</span></div>
      ${vs.map(cardHtml).join('')}
      <div class="cvx-cmpbar"><button class="cvx-cmpbtn">${cwIc('scale',{size:13,sw:1.7})} Compare kept side by side</button><span class="hint">keep two or more — comparison is the product</span></div>
      <div class="cvx-cmp" hidden></div>
      <div class="cw-field"><div class="cw-flabel">Note to the room <span class="src">optional</span></div><input class="cw-in cvx-note" placeholder="e.g. the props version, but keep her line where it is" value="${cwEsc(o.note)}"></div>
      <div class="cvx-payload"><div class="cap"><span>What commits</span><span class="ceil"></span></div><div class="cvx-pl"></div><div class="cvx-meter"><i style="width:0"></i></div></div>`;
  };
  const renderCmp=()=>{
    const box=menu.querySelector('.cvx-cmp'), btn=menu.querySelector('.cvx-cmpbtn'), hint=menu.querySelector('.cvx-cmpbar .hint');
    const ids=[...sel.keys()].slice(0,3);
    btn.disabled=ids.length<2; btn.style.opacity=ids.length<2?.45:1;
    hint.textContent=ids.length<2?'keep two or more — comparison is the product':(cmp?'the invariant stays pinned above both':'side by side, invariant pinned');
    if(!cmp||ids.length<2){ box.hidden=true; return; }
    box.hidden=false;
    box.innerHTML=`<div class="inv"><b>must survive:</b> ${cwEsc(root.querySelector('.cvx-surv').value)}</div>
      <div class="cvx-cols">${ids.map(id=>{const v=cvxOf(id);
        return `<div class="cvx-col"><div class="h">${v.nm}<span class="cvx-dist${v.dist<.5?' lo':''}">${v.dist.toFixed(2)}</span></div><p class="p">${cwEsc(v.t)}</p><p class="e">${v.tr}</p></div>`;}).join('')}</div>`;
  };
  const renderPayload=()=>{
    const pl=menu.querySelector('.cvx-pl'), ceil=menu.querySelector('.ceil'), meter=menu.querySelector('.cvx-meter');
    const note=(menu.querySelector('.cvx-note')||{}).value||'';
    if(!sel.size){ pl.innerHTML='<span class="none">nothing kept yet — commit stays off, and the whole generation cloud is thrown away</span>'; ceil.textContent=''; meter.classList.remove('over'); meter.firstElementChild.style.width='0'; commit.disabled=true; return; }
    const surv=root.querySelector('.cvx-surv').value;
    const frame = mode==='bound' ? `${bound.pressure} · ${bound.distance} · ${bound.channel} · ${bound.commit}` : `open · ${CVX_DIST[dist].n.toLowerCase()} (${CVX_DIST[dist].s})`;
    let lines=[`<span class="k">passage:</span> \u201C${cwEsc(CVX_PASSAGE.slice(0,58))}\u2026\u201D`,`<span class="k">sampling:</span> ${cwEsc(frame)}`,`<span class="k">must survive:</span> ${cwEsc(surv)}`];
    let plain=[CVX_PASSAGE.slice(0,58),frame,surv].join(' ');
    [...sel.entries()].forEach(([id,mo])=>{
      const v=cvxOf(id), txt = mo==='dir' ? v.dir : '\u201C'+v.t.replace(/\n/g,' / ')+'\u201D';
      lines.push(`<span class="d">·</span> ${cwEsc(txt)}`); plain+=' '+txt;
      if(v.flag&&okFlags.has(id)&&mo==='prose'){ lines.push(`<span class="k">accepted:</span> ${cwEsc(v.flag.t)} — treat as canon`); plain+=' '+v.flag.t; }
    });
    if(note){ lines.push(`<span class="k">note:</span> ${cwEsc(note)}`); plain+=' '+note; }
    pl.innerHTML=lines.join('\n');
    const n=plain.length, over=n>CVX_CEIL;
    ceil.textContent=`${n} / ${CVX_CEIL} chars`; ceil.classList.toggle('over',over);
    meter.classList.toggle('over',over); meter.firstElementChild.style.width=Math.min(100,n/CVX_CEIL*100)+'%';
    commit.disabled=!o.live;
    if(!o.live) commit.title='Commit is live in the flow demo (§1)';
  };
  const update=()=>{
    root.querySelector('.cw-count').textContent = menu.hidden?'':(sel.size?sel.size+' kept · ':'');
    if(menu.hidden) return;
    menu.querySelectorAll('.cvx-card').forEach(el=>{
      const m=sel.get(el.dataset.id);
      el.classList.toggle('sel',!!m);
      el.querySelectorAll('[data-carry]').forEach(b=>b.classList.toggle('on',b.dataset.carry===(m||'prose')));
      const f=el.querySelector('.cvx-flag');
      if(f){ const ok=okFlags.has(el.dataset.id); f.classList.toggle('ok',ok);
        f.innerHTML=(ok?cwIc('check',{size:9,sw:3}):cwIc('x',{size:9,sw:2.6}))+' '+(ok?'accepted \u2014 rides as new canon':cvxOf(el.dataset.id).flag.t); }
    });
    renderCmp(); renderPayload();
  };
  menu.addEventListener('click',e=>{
    if(e.target.closest('[data-regen]')){ dup=false; renderMenu(); update(); return; }
    if(e.target.closest('.cvx-cmpbtn')){ cmp=!cmp; renderCmp(); return; }
    const fb=e.target.closest('[data-flag]');
    if(fb){ const id=fb.dataset.flag; okFlags.has(id)?okFlags.delete(id):okFlags.add(id); update(); return; }
    const cb=e.target.closest('[data-carry]');
    if(cb){ const el=cb.closest('.cvx-card'); if(sel.has(el.dataset.id)) sel.set(el.dataset.id,cb.dataset.carry); update(); return; }
    const card=e.target.closest('.cvx-card');
    if(card){ const id=card.dataset.id; sel.has(id)?sel.delete(id):sel.set(id,o.carry[id]||'prose'); update(); }
  });
  menu.addEventListener('input',e=>{ if(e.target.classList.contains('cvx-note')) renderPayload(); });

  const reveal=()=>{ menu.hidden=false; renderMenu(); gen.className='cw-gen ghost'; gen.innerHTML=`${cwIc('refresh',{size:12,sw:1.8})} Regenerate the workup`; const s=root.querySelector('.cw-seam'); if(s) s.remove(); update(); };
  gen.addEventListener('click',()=>{
    if(gen.classList.contains('busy')) return;
    gen.classList.add('busy'); gen.innerHTML='One call · closed schema · three to five items…';
    setTimeout(()=>{ gen.classList.remove('busy');
      if(menu.hidden) reveal(); else { renderMenu(); update(); gen.innerHTML=`${cwIc('refresh',{size:12,sw:1.8})} Regenerate the workup`; } },1000);
  });

  renderModes(); renderPane();
  if(o.state==='menu'){ reveal(); o.preselect.forEach(id=>{ if(cvxOf(id)) sel.set(id,o.carry[id]||'prose'); }); (o.accepted||[]).forEach(id=>okFlags.add(id)); update(); }
  if(o.live){
    root.querySelector('.cvx-cancel').addEventListener('click',cwClose);
    commit.addEventListener('click',()=>{
      const items=[...sel.entries()].map(([id,mo])=>({id,mode:mo}));
      const carry={}; sel.forEach((m,id)=>carry[id]=m);
      o.onCommit&&o.onCommit({items,carry,mode,dist,note:(menu.querySelector('.cvx-note').value||'').trim(),accepted:[...okFlags]});
    });
  }
  update();
  return root;
}

/* ---------- live flow ---------- */
function mountCvxFlow(id){
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
  const open=opts=> cwOpen(buildCvxPanel(Object.assign({live:true,onCommit:commitDraft},opts)));
  const openBrowser=()=> cwOpen(buildWidgetBrowser(w=>{ if(w.id==='cvx') open({}); },true,['cvx']),true);

  function commitDraft(d){
    cwClose();
    const kept=d.items.length, dirs=d.items.filter(i=>i.mode==='dir').length;
    const label = d.mode==='bound' ? 'a bound frame' : CVX_DIST[d.dist].n.toLowerCase();
    const m=add('you',`Ran the mug beat through the Explorer at <span class="cw-q">${cwEsc(label)}</span> — these are the directions worth taking${d.note?` — <i>${cwEsc(d.note)}</i>`:''}.`);
    const wrap=document.createElement('div'); wrap.className='cw-chipwrap';
    const chip=document.createElement('button'); chip.className='cw-chip';
    chip.innerHTML=`${cwIc('branch',{size:13,sw:1.8})} Creative Variations <span class="m">${kept} kept${dirs?` · ${dirs} as direction`:''} · re-open</span>`;
    chip.title='Presentation-only — the model never sees this chip';
    chip.addEventListener('click',()=> open({state:'menu',banner:'clone',mode:d.mode,dist:d.dist,preselect:d.items.map(i=>i.id),carry:d.carry,note:d.note,accepted:d.accepted,compare:kept>1}));
    wrap.appendChild(chip); m.appendChild(wrap); thread.scrollTop=thread.scrollHeight;
    const t=document.createElement('div'); t.className='cw-msg jill';
    t.innerHTML=`<div class="cw-who"><span class="dot"></span>Jill · persona</div><div class="cw-typing"><i></i><i></i><i></i></div>`;
    setTimeout(()=>{ thread.appendChild(t); thread.scrollTop=thread.scrollHeight; },500);
    setTimeout(()=>{
      const first=d.items[0], v=first&&cvxOf(first.id);
      let r='Took the beat again along those lines. ';
      if(v) r+=`<div class="lg-quote">${cwEsc((first.mode==='dir'?CVX_OPEN[1].t:v.t).replace(/\n/g,' \u2014 '))}</div>`;
      r+='Nobody says the word trust and nobody smiles. Want the same treatment on the doorway beat two pages back — or should I leave that one told?';
      t.querySelector('.cw-typing').outerHTML=`<div class="cw-body">${r}</div>`;
      thread.scrollTop=thread.scrollHeight;
    },2100);
  }

  add('you','I\u2019ve rewritten this kitchen paragraph four times and every version is the same version. I can\u2019t tell if the beat is wrong or if I\u2019ve just run out of ideas about it.');
  const j=add('jill','You haven\u2019t run out \u2014 you keep landing in the same tenth of the distribution, because that\u2019s where competent revision lives. Let me put five <span class="cw-q">deliberately unlike</span> takes next to each other, all obeying the same invariants, and you tell me which one is a direction rather than a rewrite.');
  const reco=document.createElement('button'); reco.className='cw-reco';
  reco.innerHTML=`${cwIc('branch',{size:13,sw:1.8})} Creative Variations Explorer <span class="m">prefilled · the mug beat</span>`;
  reco.addEventListener('click',()=> open({banner:'seed',dist:2}));
  j.querySelector('.cw-body').appendChild(reco);
  host.querySelector('.cw-wbtn').addEventListener('click',openBrowser);
  return {open,openBrowser};
}

function mountCvxFrame(id,opts){
  document.getElementById(id).appendChild(buildCvxPanel(Object.assign({live:false},opts)));
}
