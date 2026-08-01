/* Lexical Gravity — spread logic. Needs icons.js + pm-widgets.js (cwIc, cwOpen, cwClose, cwXBtn, cwEsc). */
const LG_SUBKEYS = [['plan','a plan'],['conflict','conflict'],['agreement','agreement'],['turning','turning point'],['ending','an ending']];
const LG_LENSES = {
  photography:{name:'Photography', src:'built-in',
    d:{1:{n:['aperture','exposure','frame','shutter','negative'],v:['focus','expose','frame','develop','capture'],m:['overexposed','blurred','sharp','backlit']},
       2:{n:['grain','contrast','darkroom','silhouette','light-leak'],v:['crop','burn','fix','enlarge'],m:['grainy','high-contrast','sepia','unfocused']},
       3:{n:['silver bath','ghosting','latency','contact sheet'],v:['bracket','dodge','redevelop'],m:['halated','solarized','undeveloped']}},
    grad:['glance','look','gaze','study','frame','exposure','contact print'],
    cliches:[['picture-perfect','framed too carefully to trust'],['a snapshot in time','one frame pulled from the reel'],['rose-tinted lenses','printed warmer than it was shot'],['the big picture','the whole contact sheet']],
    subs:{plan:'framing',conflict:'glare',agreement:'focus',turning:'the develop',ending:'the final print'},
    meta:'the whole evening a contact sheet he would never print',
    sample:'She stood at the window, overexposed in the last light, and he stopped the moment down until it held.'},
  music:{name:'Music', src:'built-in',
    d:{1:{n:['tempo','chord','key','refrain','cadence'],v:['tune','resolve','swell','hum'],m:['off-key','muted','resonant','minor']},
       2:{n:['dissonance','downbeat','tremolo','rest','interval'],v:['modulate','syncopate','harmonize','transpose'],m:['staccato','legato','atonal']},
       3:{n:['coda','attack','decay','overtone','cadenza'],v:['orchestrate','improvise','retune'],m:['contrapuntal','unresolved','polyphonic']}},
    grad:['plan','outline','pattern','sequence','arrangement','composition','score'],
    cliches:[['struck a chord','resonated in a minor key'],['music to my ears','landed like a held note'],['marching to their own drum','keeping a time signature nobody else could count'],['change their tune','modulate mid-phrase']],
    subs:{plan:'score',conflict:'dissonance',agreement:'harmony',turning:'key change',ending:'coda'},
    meta:'her patience a held note going flat',
    sample:'The kitchen kept its own tempo — kettle, clock, her knife on the board — and his apology came in under the beat.'},
  math:{name:'Mathematics', src:'built-in',
    d:{1:{n:['sum','angle','proof','factor','curve'],v:['divide','count','equal','solve'],m:['even','odd','exact','negative']},
       2:{n:['asymptote','remainder','axiom','vector','prime'],v:['converge','derive','approximate','cancel'],m:['irrational','finite','parallel','inverse']},
       3:{n:['limit','series','integral','singularity'],v:['integrate','tend','diverge'],m:['undefined','imaginary','asymptotic']}},
    grad:['hunch','guess','estimate','conjecture','hypothesis','theorem','proof'],
    cliches:[['do the math','run the proof'],['it doesn\u2019t add up','the remainder never comes out even'],['lowest common denominator','the term everything reduces to'],['a zero-sum game','an equation that only balances by loss']],
    subs:{plan:'a proof',conflict:'contradiction',agreement:'equality',turning:'inflection point',ending:'the limit'},
    meta:'their marriage an equation that balanced only when nobody checked the work',
    sample:'He kept subtracting himself from the room, and the remainder was always her.'},
  weather:{name:'Weather', src:'built-in',
    d:{1:{n:['front','drizzle','thaw','gust','forecast'],v:['clear','cloud','gust','thaw'],m:['overcast','humid','brisk','unsettled']},
       2:{n:['pressure','squall','fogbank','barometer'],v:['lift','break','settle in','blow over'],m:['low-pressure','gale-force','socked-in']},
       3:{n:['isobar','petrichor','doldrums','microclimate'],v:['precipitate','occlude'],m:['anticyclonic','becalmed']}},
    grad:['mood','temper','air','atmosphere','pressure','front'],
    cliches:[['the calm before the storm','the pressure dropping before anyone smells rain'],['under the weather','socked in'],['a ray of sunshine','a break in the overcast'],['weather the storm','ride out the squall']],
    subs:{plan:'forecast',conflict:'squall',agreement:'clear skies',turning:'the front',ending:'the clearing'},
    meta:'his moods moving through the house like fronts',
    sample:'Something in her had been overcast for days and was only now considering rain.'},
  botany:{name:'Botany', src:'built-in',
    d:{1:{n:['root','stem','bloom','seed','thorn'],v:['bloom','wilt','prune','take root'],m:['overgrown','budding','fallow','tender']},
       2:{n:['graft','tendril','sap','canopy','perennial'],v:['graft','deadhead','propagate','cling'],m:['deep-rooted','invasive','hardy','dormant']},
       3:{n:['rhizome','sepal','understory','cambium'],v:['etiolate','photosynthesize','self-seed'],m:['heliotropic','vestigial','deciduous']}},
    grad:['kin','line','stock','strain','graft','rootstock'],
    cliches:[['nipped in the bud','pruned before it could set fruit'],['putting down roots','going rootbound in a small pot'],['a late bloomer','flowering out of season'],['the grass is greener','envying the neighbor\u2019s loam']],
    subs:{plan:'the graft',conflict:'blight',agreement:'full bloom',turning:'first frost',ending:'going to seed'},
    meta:'an apology grafted onto old wood',
    sample:'The silence between them had gone to seed.'},
  architecture:{name:'Architecture', src:'built-in',
    d:{1:{n:['threshold','beam','wall','arch','foundation'],v:['frame','brace','anchor','build on'],m:['load-bearing','structural','sound','level']},
       2:{n:['cantilever','facade','joist','footing','lintel'],v:['shore up','underpin','buttress'],m:['freestanding','condemned','plumb','vaulted']},
       3:{n:['spandrel','vault','shear','cornice'],v:['cantilever','retrofit'],m:['brutalist','trabeated','unreinforced']}},
    grad:['idea','sketch','plan','draft','schematic','blueprint'],
    cliches:[['built on a solid foundation','footings poured deep'],['the walls closing in','the room losing its plumb'],['hit the ceiling','crack the lintel'],['a bridge too far','a span past its load rating']],
    subs:{plan:'blueprint',conflict:'shear',agreement:'true plumb',turning:'the keystone',ending:'the capstone'},
    meta:'the marriage a cantilever, all its weight on one hidden beam',
    sample:'The doorway held them, a threshold neither of them would load.'}
};
const LG_LOOKUP = {
  options:[
    {v:'hunt', t:'Falconry — the hunt', d:'stoop, quarry, flush, strike — pursuit, patience, and the moment of commitment'},
    {v:'manning', t:'Falconry — manning & keeping', d:'jess, hood, mews, bate — trust, restraint, and the long taming'}],
  lens:{name:'Falconry', src:'project',
    d:{1:{n:['stoop','quarry','jess','hood','mews'],v:['stoop','flush','strike','cast off'],m:['hooded','sharp-set','haggard','unmanned']},
       2:{n:['bate','creance','lure','pitch','tiercel'],v:['bate','man','rouse','feed up'],m:['imprinted','keen','full-cropped']},
       3:{n:['yarak','austringer','hack','brail'],v:['enseam','reclaim','wait on'],m:['passage-caught','eyass-raised']}},
    grad:['want','appetite','hunger','edge','sharp-set','yarak'],
    cliches:[['watching like a hawk','waiting on, high and out of sight'],['free as a bird','flying at hack'],['clipped wings','kept in the mews too long'],['talons out','binding to whatever rises']],
    subs:{plan:'the cast',conflict:'the bate',agreement:'coming to the fist',turning:'the stoop',ending:'the feed-up'},
    meta:'her attention a falcon waiting on, high and out of sight',
    sample:'He came back to her the way a falcon comes back — not tamed, just hungry in a way she could answer.'}
};
const lgW = w => w<25?'a trace':w<55?'present, not loud':w<85?'forward':'saturated';
const lgR = r => r===1?'core vocabulary only':r===2?'core + adjacent':'core + far associations';
const lgFmt = c => `${LG_LENSES[c.lens].name} · ${c.weight}% · ${c.reach}°${c.metaphor?' · metaphor':''}`;
const LG_POS = [['n','nouns'],['v','verbs'],['m','modifiers']];

function buildGravityPanel(o){
  o = Object.assign({lens:'photography', weight:60, reach:2, metaphor:false, mode:'install', banner:null, preview:false, live:true, tab:'field', pos:'n', contrast:null, lookup:'idle', onCommit:null}, o);
  const cfg = {lens:o.lens, weight:o.weight, reach:o.reach, metaphor:o.metaphor};
  let tab=o.tab, pos=o.pos, contrast=o.contrast;
  const root = document.createElement('div'); root.className='cw-panel';
  if(o.live) root.appendChild(cwXBtn());
  root.insertAdjacentHTML('beforeend',`
    <div class="cw-eyebrow">Widget <span class="cw-rail standing">standing · prose directive</span></div>
    <h2>${cwIc('orbit',{size:17,sw:1.8})} Lexical Gravity</h2>
    <p class="cw-sub">Pull the passage\u2019s lexis toward an interpretive lens. Installs a <b>passage-scoped directive</b> consulted only when prose is written — a knob on the <b>work</b>, never on the participant.</p>
    <div class="cw-bslot"></div>
    <div class="cw-field"><div class="lg-section-title">Build New Lens</div>
      <div class="lg-lookup"><input class="cw-in lg-lkin" value="falconry" placeholder="Look up or invent a lens\u2026"><button class="cw-btn lg-lkbtn">${cwIc('sparkle',{size:12,sw:1.8})} Build lens</button></div>
      <div class="lg-lkslot"></div>
      <div class="lg-or"><span>OR</span></div>
      <div class="lg-existing-title">Select From Existing</div>
      <div class="cw-flabel lg-library-label">Lens <span class="src">built-ins + project lenses · blending is Sprint 04</span></div>
      <div class="lg-lenses"></div></div>
    <div class="lg-slider"><div class="lab">Weight <span class="val lg-wval"></span></div><input type="range" class="lg-range lg-wr" min="10" max="100" step="5" value="${cfg.weight}"></div>
    <div class="lg-slider"><div class="lab">Reach <span class="val lg-rval"></span></div><input type="range" class="lg-range lg-rr" min="1" max="3" step="1" value="${cfg.reach}"></div>
    <div class="lg-trow"><div class="tt"><div class="tn">Metaphor pull</div><div class="td">Let images cross domains — not just word choice but figuration drawn through the lens.</div></div><span class="lg-tog${cfg.metaphor?' on':''}"><i></i></span></div>
    <div class="lg-fieldbox">
      <div class="lg-tabs"><button data-tab="field">Word field</button><button data-tab="grad">Gradient</button><button data-tab="subs">Substitutions</button><button data-tab="cliche">Clichés</button><span class="lg-fw"></span></div>
      <div class="lg-fbody"></div>
      <div class="lg-fcap">deterministic scaffold — no model call, redrawn instantly</div></div>
    <div class="lg-prevslot"></div>
    <button class="cw-gen ghost lg-pv">${cwIc('sparkle',{size:12,sw:1.8})} Preview the Effect</button>
    <div class="cw-foot">
      <span class="cw-fnote">${o.mode==='edit'?'Applies <b>between runs</b> and leaves a \u201Cshifted\u201D marker in the thread.':'Installs <b>between runs</b> — an in-flight reply is never interrupted.'}</span>
      ${o.live?'<button class="cw-btn ghost lg-cancel">Cancel</button>':''}
      <button class="cw-btn primary lg-commit"${o.live?'':' disabled'}>${o.mode==='edit'?'Apply':'Install on passage'}</button>
    </div>`);
  const bslot=root.querySelector('.cw-bslot');
  if(o.banner==='seed') bslot.innerHTML=`<div class="cw-banner seed">${cwIc('sparkle',{size:13,sw:1.8})}<span><b>Recommended and prefilled by Jill.</b> Proposing is as far as a persona goes — standing state is always writer-committed.</span></div>`;
  if(o.banner==='edit') bslot.innerHTML=`<div class="cw-banner clone">${cwIc('refresh',{size:13,sw:1.8})}<span><b>Editing the live directive.</b> There is one active directive per family. Apply updates the standing frame between runs; changes stay local until then.</span></div>`;
  const grid=root.querySelector('.lg-lenses'), fbody=root.querySelector('.lg-fbody'), prevslot=root.querySelector('.lg-prevslot'), pv=root.querySelector('.lg-pv'), lkslot=root.querySelector('.lg-lkslot');
  const pickContrast=()=>{ const ks=Object.keys(LG_LENSES).filter(k=>k!==cfg.lens); if(!contrast||contrast===cfg.lens||!LG_LENSES[contrast]) contrast=ks[0]; return contrast; };
  const renderGrid=()=>{
    grid.innerHTML=Object.keys(LG_LENSES).map(k=>{
      const L=LG_LENSES[k];
      return `<button class="lg-lens${k===cfg.lens?' sel':''}" data-lens="${k}" title="${cwEsc(L.name)}"><span class="n">${L.name}${L.src==='project'?'<span class="newb">project</span>':''}</span><span class="w">${L.d[1].n.slice(0,3).join(' · ')}</span></button>`;
    }).join('');
  };
  const renderField=()=>{
    const L=LG_LENSES[cfg.lens];
    root.querySelector('.lg-wval').textContent=`${cfg.weight}% · ${lgW(cfg.weight)}`;
    root.querySelector('.lg-rval').textContent=`${cfg.reach}° · ${lgR(cfg.reach)}`;
    root.querySelector('.lg-fw').textContent=L.name.toLowerCase();
    root.querySelectorAll('.lg-tabs [data-tab]').forEach(b=>b.classList.toggle('on',b.dataset.tab===tab));
    if(tab==='field'){
      const op=d=>((1-(d-1)*.22)*(0.4+0.6*cfg.weight/100)).toFixed(2);
      let h=`<div class="lg-pos">${LG_POS.map(([k,lab])=>`<button data-pos="${k}"${k===pos?' class="on"':''}>${lab}</button>`).join('')}</div>`;
      for(let d=1; d<=cfg.reach; d++){
        h+=`<div class="lg-degrow"><span class="deg">${d}°</span><span class="lg-chips">${L.d[d][pos].map(w=>`<span class="lg-chip" style="opacity:${op(d)}">${w}</span>`).join('')}</span></div>`;
      }
      if(cfg.metaphor) h+=`<div class="lg-metarow"><span class="m">metaphor</span>${L.meta}</div>`;
      fbody.innerHTML=h;
    } else if(tab==='grad'){
      const g=L.grad;
      fbody.innerHTML=`<div class="lg-gradrow">${g.map((w,i)=>`<span class="g">${w}</span>${i<g.length-1?'<span class="a">→</span>':''}`).join('')}</div>
        <div class="lg-gradcap">semantic gradient · general → ${L.name.toLowerCase()} · sampled from the field</div>`;
    } else if(tab==='cliche'){
      fbody.innerHTML=`${L.cliches.map(([worn,fresh])=>`<div class="lg-clrow"><span class="worn">${worn}</span><span class="a">→</span><span class="fresh">${fresh}</span></div>`).join('')}
        <div class="lg-gradcap">worn phrases from this lens — the directive steers around them; the refresh column is the field’s own way out</div>`;
    } else {
      const C=LG_LENSES[pickContrast()];
      fbody.innerHTML=`<table class="lg-subt"><tr><th>general</th><th>${L.name.toLowerCase()}</th><th>vs. ${C.name.toLowerCase()} <button class="lg-shuf" title="Shuffle contrast lens">↻</button></th></tr>
        ${LG_SUBKEYS.map(([k,lab])=>`<tr><td class="gen">${lab}</td><td class="sel">${L.subs[k]}</td><td>${C.subs[k]}</td></tr>`).join('')}</table>`;
      fbody.querySelector('.lg-shuf').addEventListener('click',()=>{
        const ks=Object.keys(LG_LENSES).filter(k=>k!==cfg.lens);
        contrast=ks[(ks.indexOf(contrast)+1)%ks.length]; renderField();
      });
    }
  };
  const clearPreview=()=>{ prevslot.innerHTML=''; };
  const showPreview=()=>{
    const L=LG_LENSES[cfg.lens];
    prevslot.innerHTML=`<div class="lg-preview"><div class="cap">one fast-tier call · sample pull at ${cfg.weight}%</div>\u201C${L.sample}${cfg.metaphor?' — '+L.meta:''}\u201D</div>`;
  };
  const renderLookupOptions=()=>{
    lkslot.innerHTML=`<div class="lg-lkopts"><div class="cap">model drafted 2 takes — pick one to add</div>
      ${LG_LOOKUP.options.map(op=>`<button class="lg-lensopt" data-v="${op.v}"><b>${op.t}</b><span>${op.d}</span></button>`).join('')}</div>`;
    lkslot.querySelectorAll('.lg-lensopt').forEach(b=>b.addEventListener('click',()=>{
      if(!LG_LENSES.falconry) LG_LENSES.falconry={...LG_LOOKUP.lens, variant:b.dataset.v};
      cfg.lens='falconry'; contrast=null; clearPreview(); renderGrid(); renderField();
      lkslot.innerHTML=`<div class="lg-saved">${cwIc('check',{size:12,sw:2.4})}<span>Saved to project — <span class="path">resources/lenses/falconry.json</span> · available in every session, every thread</span></div>`;
    }));
  };
  grid.addEventListener('click',e=>{
    const b=e.target.closest('.lg-lens'); if(!b) return;
    cfg.lens=b.dataset.lens; contrast=null;
    renderGrid(); clearPreview(); renderField();
  });
  root.querySelector('.lg-lkbtn').addEventListener('click',e=>{
    const btn=e.currentTarget; if(btn.classList.contains('busy')) return;
    btn.classList.add('busy'); btn.innerHTML='Drafting\u2026';
    setTimeout(()=>{ btn.classList.remove('busy'); btn.innerHTML=`${cwIc('sparkle',{size:12,sw:1.8})} Build lens`; renderLookupOptions(); },900);
  });
  root.querySelector('.lg-tabs').addEventListener('click',e=>{ const b=e.target.closest('[data-tab]'); if(b){ tab=b.dataset.tab; renderField(); } });
  fbody.addEventListener('click',e=>{ const b=e.target.closest('[data-pos]'); if(b){ pos=b.dataset.pos; renderField(); } });
  root.querySelector('.lg-wr').addEventListener('input',e=>{ cfg.weight=+e.target.value; clearPreview(); renderField(); });
  root.querySelector('.lg-rr').addEventListener('input',e=>{ cfg.reach=+e.target.value; clearPreview(); renderField(); });
  root.querySelector('.lg-tog').addEventListener('click',e=>{ cfg.metaphor=!cfg.metaphor; e.currentTarget.classList.toggle('on',cfg.metaphor); clearPreview(); renderField(); });
  pv.addEventListener('click',()=>{
    if(pv.classList.contains('busy')) return;
    pv.classList.add('busy'); pv.innerHTML='One fast model call…';
    setTimeout(()=>{ pv.classList.remove('busy'); pv.innerHTML=`${cwIc('refresh',{size:12,sw:1.8})} Preview again`; showPreview(); },900);
  });
  if(o.preview){ showPreview(); pv.innerHTML=`${cwIc('refresh',{size:12,sw:1.8})} Preview again`; }
  if(o.lookup==='options') renderLookupOptions();
  if(o.live){
    root.querySelector('.lg-cancel').addEventListener('click',cwClose);
    root.querySelector('.lg-commit').addEventListener('click',()=> o.onCommit && o.onCommit({...cfg}));
  } else {
    root.querySelector('.lg-commit').title='Commit is live in the flow demo (§1)';
  }
  renderGrid(); renderField();
  return root;
}

/* ---------- live flow stage ---------- */
function mountGravityFlow(id){
  const host=document.getElementById(id);
  host.innerHTML=`<div class="cw-thread"></div>
    <div class="lg-slot"></div>
    <div class="cw-composer">
      <div class="cw-cinput">Continue with Jill\u2026</div>
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
    <div class="cw-hint">Click <b>Widgets</b> or Jill\u2019s chip. Once installed, the amber strip <b>is</b> the live directive — edit it, or kill it with one click</div>`;
  const thread=host.querySelector('.cw-thread'), slot=host.querySelector('.lg-slot');
  const state={active:null};
  const add=(who,html)=>{
    const m=document.createElement('div'); m.className='cw-msg '+who;
    m.innerHTML=(who==='jill'?`<div class="cw-who"><span class="dot"></span>Jill · persona</div>`:`<div class="cw-who">You</div>`)+`<div class="cw-body">${html}</div>`;
    thread.appendChild(m); thread.scrollTop=thread.scrollHeight; return m;
  };
  const marker=(cls,text)=>{
    const m=document.createElement('div'); m.className='lg-marker '+cls;
    m.innerHTML=`<span class="d"></span>${text}`;
    thread.appendChild(m); thread.scrollTop=thread.scrollHeight;
  };
  const renderActive=()=>{
    if(!state.active){ slot.innerHTML=''; return; }
    slot.innerHTML=`<div class="lg-active"><span class="pulse"></span><b>Lexical Gravity</b><span class="cfg">${lgFmt(state.active)}</span><span class="sp"></span><button class="ed">Edit</button><button class="kill" title="Remove the directive">${cwIc('x',{size:11,sw:2})}</button></div>`;
    slot.querySelector('.ed').addEventListener('click',()=>openGravity({banner:'edit'}));
    slot.querySelector('.kill').addEventListener('click',()=>{
      state.active=null; renderActive();
      marker('kill','Lexical Gravity removed — the passage stops gravitating');
    });
  };
  const openGravity=(opts)=> cwOpen(buildGravityPanel(Object.assign({live:true, mode:state.active?'edit':'install', onCommit:commit}, state.active||{}, opts)));
  const openBrowser=()=> cwOpen(buildWidgetBrowser(w=>{ if(w.id==='gravity') openGravity({}); }, true, ['gravity']), true);
  function commit(cfg){
    cwClose();
    if(!state.active){
      state.active=cfg; renderActive();
      marker('','Lexical Gravity installed — '+lgFmt(cfg));
      const t=document.createElement('div'); t.className='cw-msg jill';
      t.innerHTML=`<div class="cw-who"><span class="dot"></span>Jill · persona</div><div class="cw-typing"><i></i><i></i><i></i></div>`;
      setTimeout(()=>{ thread.appendChild(t); thread.scrollTop=thread.scrollHeight; },500);
      setTimeout(()=>{
        const L=LG_LENSES[cfg.lens];
        t.querySelector('.cw-typing').outerHTML=`<div class="cw-body">Ran the last beat under the ${L.name} field — the lens is never named, the vocabulary just gravitates:<div class="lg-quote">${L.sample}${cfg.metaphor?' — '+L.meta:''}</div>The strip above the composer is the live directive. Ease the weight, widen the reach, or kill it any time.</div>`;
        thread.scrollTop=thread.scrollHeight;
      },2100);
    } else {
      const old=lgFmt(state.active), nw=lgFmt(cfg);
      state.active=cfg; renderActive();
      if(old!==nw) marker('shift',`shifted — ${old} → ${nw}`);
    }
  }
  add('you','This is Anselm\u2019s chapter — he sees everything through the camera he no longer owns. Can the prose lean that way without me ever saying \u201Ccamera\u201D?');
  const j=add('jill','That\u2019s not a persona ask — nobody\u2019s voice changes, no mode moves. It’s a pull on the <span class="cw-q">passage itself</span>. Install Lexical Gravity with a Photography lens: every rewrite gravitates until you kill it.');
  const reco=document.createElement('button'); reco.className='cw-reco';
  reco.innerHTML=`${cwIc('orbit',{size:13,sw:1.8})} Lexical Gravity <span class="m">prefilled · Photography</span>`;
  reco.addEventListener('click',()=>openGravity({banner: state.active?'edit':'seed'}));
  j.querySelector('.cw-body').appendChild(reco);
  host.querySelector('.cw-wbtn').addEventListener('click',openBrowser);
  return {openGravity};
}

function mountGravityFrame(id, opts){
  document.getElementById(id).appendChild(buildGravityPanel(Object.assign({live:false},opts)));
}
