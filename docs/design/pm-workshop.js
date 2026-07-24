/* =========================================================================
   Prose Minion — Workshop tab (consolidated). Needs icons.js + pm-widgets.js.
   Exposes window.PMW for pm-sessions.js.
   ========================================================================= */
const PMW = (() => {
  const $ = s => document.querySelector(s);
  const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const fmt = n => n.toLocaleString('en-US');

  /* ---------- data ---------- */
  const PERSONAS = {
    jill:  {name:'Jill',        spec:'Creative writing partner', glyph:'sparkle',  desc:'Warm developmental and line-level craft support for the work in front of you.'},
    agnes: {name:'Sister Agnes',spec:'Theme & symbolism',        glyph:'sparkle',  desc:'Keeps themes embodied, symbols intentional, and insight earned on the page.'},
    cliff: {name:'Cliff',       spec:'Cliché & repetition',      glyph:'repeat',   desc:'Finds tired phrasing, echo words, and accidental patterns without mistaking motifs for tics.'},
    dev:   {name:'Dev',         spec:'Dialogue & microbeats',    glyph:'dialogue', desc:'Listens for distinct voices, subtext, purposeful tags, and physical beats that reveal character.'},
    edna:  {name:'Edna',        spec:'Reader-breaking logic',    glyph:'target',   desc:'Flags only contradictions, impossible scene logic, and trust-breaking information errors.'},
    felix: {name:'Felix',       spec:'Rhythm & pacing',          glyph:'wave',     desc:'Reads for sentence music, white space, pace, and the moments prose needs a rest.'},
    harper:{name:'Harper',      spec:'Craft mentorship',         glyph:'sprout',   desc:'Turns visible patterns into durable writing principles and practical habits.'},
    margot:{name:'Margot',      spec:'Voice & POV',              glyph:'eye',      desc:'Tracks narrative distance, point of view, tense, and whether the narration stays in character.'},
    penny: {name:'Penny',       spec:'Reader experience',        glyph:'book',     desc:'Responds as an attentive young reader who knows only what the page has earned.'},
    quinn: {name:'Quinn',       spec:'Continuity & canon',       glyph:'search',   desc:'Checks names, timelines, and facts against the story bible and prior chapters.'},
    theo:  {name:'Theo',        spec:'Momentum & tension',       glyph:'bolt',     desc:"Tracks stakes, forward pull, and where a scene's energy sags."},
    wren:  {name:'Wren',        spec:'Line & style',             glyph:'pen',      desc:"Sentence-level polish: diction, cadence, and cutting what the line doesn't need."},
  };
  const HOST_ORDER = ['jill','agnes','cliff','dev','edna','felix','harper','margot','penny','quinn','theo','wren'];

  const TOOLS = [
    {g:'Primary',       n:'Dialogue & Beats', i:'dialogue', d:'Cadence, subtext, and the microbeats between lines.'},
    {g:'Primary',       n:'Prose',            i:'pen',      d:'Line-level rewrite suggestions for flow and clarity.'},
    {g:'Primary',       n:'Gestures',         i:'hand',     d:'Body language — variety, repetition, and intent.'},
    {g:'Craft & Voice', n:'Choreography',     i:'move',     d:'Spatial logic of movement through a scene.'},
    {g:'Craft & Voice', n:'Cliché',           i:'stamp',    d:'Surface tired phrasings and stock images.'},
    {g:'Craft & Voice', n:'Repetition',       i:'repeat',   d:'Echoed words, structures, and tics across the passage.'},
    {g:'Craft & Voice', n:'Show & Tell',      i:'eye',      d:'Where you summarize vs. dramatize on the page.'},
    {g:'Craft & Voice', n:'Decision Points',  i:'branch',   d:'Moments where a character chooses — and the stakes.'},
    {g:'Craft & Voice', n:'Stock & Signature',i:'target',   d:'Generic beats vs. your distinctive authorial moves.'},
    {g:'Technical',     n:'Style',            i:'palette',  d:'Weak verbs, adverbs, filler, and passive voice.'},
    {g:'Technical',     n:'Editor',           i:'list',     d:'A holistic developmental editor pass.'},
    {g:'Technical',     n:'Continuity',       i:'link',     d:'Contradictions against characters and prior chapters.'},
    {g:'Technical',     n:'Placeholders',     i:'search',   d:'Find TODOs, [brackets], and unfinished seams.'},
    {g:'Technical',     n:'Fresh',            i:'sprout',   d:'Fresh-eyes reactions, as a first-time reader.'},
  ];
  const RAIL_TOOLS = ['Dialogue & Beats','Prose','Gestures','Choreography','Cliché','Show & Tell'];

  const EXCERPT_TEXT = `# Pentecost

They moved toward the auditorium as a group, but Nate felt himself floating slightly above the moment—in that hush before the brushstroke. The edge of something breaking.

The auditorium doors loomed ahead, heavy and dark.

"They can't make us do this," Kayla said, but her voice didn't believe it.`;

  const MODES = {analysis:'Analyze', balanced:'Balanced', conversational:'Converse'};
  const MODELS = ['Arcee Trinity Large Thinking','Claude Opus 4.8','Claude Sonnet 4.6','GPT-5.2','Gemini 3.5 Pro'];

  /* ---------- state ---------- */
  const state = {
    excerpt: null,            // {title, source, version, words, text}
    context: [],              // [{kind,label,words}]
    host: 'jill',
    mode: 'balanced', expr: 'amplified', depth: 'reflective',
    profileShared: false, carryCues: true,
    todo: [],
    transcript: null,         // when restored: [{who,text,by}]
    participants: null,       // [personaId] restored in the room
    restored: false,
    session: null,            // {name}
    model: 'Arcee Trinity Large Thinking',
    processed: 0,
  };
  const BUDGET = 35000;
  const ctxTotal = () => state.context.reduce((a,x)=>a+x.words,0);

  /* ---------- icon helpers ---------- */
  const personIc = (o={}) => IC('<circle cx="12" cy="8" r="3.4"/><path d="M5.3 20c0-3.9 3-6.5 6.7-6.5s6.7 2.6 6.7 6.5"/>', Object.assign({sw:1.7}, o));
  function hostGlyphs(id, size){
    const p = PERSONAS[id]; const g = size >= 24 ? Math.round(size*0.6) : Math.round(size*0.68);
    return personIc({size,sw:1.7}) + `<span class="glyph">${(ICONS[p.glyph]||ICONS.sparkle)({size:g,sw:2})}</span>`;
  }
  function hostName(id){ return PERSONAS[id].name; }

  /* ---------- header ---------- */
  function renderTopIcons(){
    $('#wk-topicons').innerHTML =
      `<span class="spark" title="Prose Minion">${ICONS.sparkle({size:15,sw:1.8})}</span>`+
      `<span title="Assistant">${ICONS.bot({size:16,sw:1.6})}</span>`+
      `<span title="Toggle panel">${ICONS.panelRight({size:15,sw:1.6})}</span>`+
      `<span title="More">${ICONS.list({size:15,sw:1.6})}</span>`;
    $('#wk-tabx').innerHTML = ICONS.x({size:12,sw:1.8});
  }
  function renderSub(){
    const e = state.excerpt;
    $('#wk-sub').innerHTML = e
      ? `${ICONS.doc({size:12})}<span>${esc(e.source)}</span> · <span class="v">v${e.version}</span> · ${fmt(e.words)} words`
      : `${ICONS.doc({size:12})}<span>No excerpt pinned yet</span>`;
  }
  function renderHeaderCluster(){
    const modelOpts = MODELS.map(m=>`<button class="wk-mitem" data-act="setmodel" data-v="${esc(m)}">${esc(m)}${m===state.model?' '+ICONS.check({size:13}):''}</button>`).join('');
    $('#wk-hcluster').innerHTML = `
      <button class="wk-persona" data-act="host" title="Workshop host — ${esc(hostName(state.host))}">
        <span class="pav">${hostGlyphs(state.host,18)}</span><span>${esc(hostName(state.host))}</span>
      </button>
      <div class="wk-menuwrap">
        <button class="wk-hbtn" data-act="sessions">${ICONS.cards({size:14,sw:1.7})}<span>${state.session?esc(state.session.name):'Sessions'}</span><span class="chev">${ICONS.chevDown({size:13})}</span></button>
        <div class="wk-menu" id="wk-sess-menu"></div>
      </div>
      <div class="wk-menuwrap">
        <button class="wk-hbtn" data-act="model">${esc(state.model)}<span class="chev">${ICONS.chevDown({size:13})}</span></button>
        <div class="wk-menu" id="wk-model-menu">${modelOpts}</div>
      </div>
      <div class="wk-sep"></div>
      <div class="wk-proc">Processed <b>${fmt(state.processed)}</b></div>
      <div class="wk-bal"><span class="dot"></span>OpenRouter <b>$12.32</b></div>`;
    if (window.PMSessions) PMSessions.renderMenu($('#wk-sess-menu'));
  }

  /* ---------- rail ---------- */
  function excerptSection(){
    if (!state.excerpt){
      return `<div class="wk-sec">
        <div class="wk-sechead"><div class="pm-eyebrow">${ICONS.doc({size:12})} Excerpt</div></div>
        <div class="btnstack">
          <button class="bigbtn" data-act="ex-type">${ICONS.pen({size:18})}Paste or type<span class="sub">verified if it matches your editor selection</span></button>
          <button class="bigbtn" data-act="ex-pick">${ICONS.doc({size:18})}Choose from project…<span class="sub">reads the file, head-slices past 10,000 words</span></button>
        </div>
        <div class="cap">The excerpt is the text this room is workshopping.</div>
      </div>`;
    }
    const e = state.excerpt;
    return `<div class="wk-sec">
      <div class="wk-sechead"><div class="pm-eyebrow">${ICONS.doc({size:12})} Excerpt</div><span class="stat-chip">EXCERPT · V${e.version}</span></div>
      <div class="wk-exhead">${ICONS.doc({size:13})} From ${esc(e.source)}</div>
      <div class="wk-expreview">${esc(e.text||'')}</div>
      <div class="sbtnrow">
        <button class="sbtn grow" data-act="ex-type">${ICONS.pen({size:13})} Paste or type</button>
        <button class="sbtn grow" data-act="ex-pick">${ICONS.doc({size:13})} Choose from project…</button>
      </div>
    </div>`;
  }
  function contextSection(){
    const has = state.context.length > 0;
    const t = ctxTotal(), pct = Math.min(100, Math.round(100*t/BUDGET));
    const tone = pct>=100?' hot':pct>=70?' warn':'';
    const meter = `<div class="meter${tone}"><div class="meter-row"><div class="meter-track"><div class="meter-fill" style="width:${Math.max(pct, t?2:0)}%"></div></div><span class="meter-nums"><b>${fmt(t)}</b> / ${fmt(BUDGET)} words</span></div><div class="meter-cap">One budget across all attachments</div></div>`;
    let body;
    if (!has){
      body = `<div class="btnstack">
        <button class="bigbtn" data-act="ctx-text">${ICONS.list({size:18})}Add text<span class="sub">notes, character sheets, anything typed</span></button>
        <button class="bigbtn" data-act="ctx-file">${ICONS.doc({size:18})}Add from project…<span class="sub">attach project files to every message</span></button>
        <button class="bigbtn" data-act="ctx-wizard">${ICONS.sparkle({size:18})}Context wizard<span class="sub">suggests project context — results are yours to keep or remove</span></button>
      </div>
      <div class="cap">Context rides along with every message, to every participant.</div>${meter}`;
    } else {
      const pills = state.context.map((x,i)=>`<span class="pill ${x.kind}">${ICONS[x.kind==='file'?'doc':x.kind==='wizard'?'sparkle':'list']({size:12})}<span class="pl">${esc(x.label)}</span><span class="ps">${fmt(x.words)} words</span><button class="px" data-act="ctx-rm" data-i="${i}" aria-label="Remove">${ICONS.x({size:9,sw:2.4})}</button></span>`).join('');
      body = `<div class="wk-pills">${pills}</div>
      <div class="sbtnrow">
        <button class="sbtn" data-act="ctx-text">${ICONS.list({size:13})} Add text</button>
        <button class="sbtn" data-act="ctx-file">${ICONS.doc({size:13})} Add from project…</button>
        <button class="sbtn" data-act="ctx-wizard">${ICONS.sparkle({size:13})} Context wizard</button>
      </div>${meter}`;
    }
    return `<div class="wk-sec">
      <div class="wk-sechead"><div class="pm-eyebrow">${ICONS.cards({size:12})} Context</div>${has?`<span class="wk-secmeta">${state.context.length} attachment${state.context.length===1?'':'s'}</span>`:''}</div>
      ${body}
    </div>`;
  }
  function toolsSection(){
    const rows = RAIL_TOOLS.map(n=>{ const t=TOOLS.find(x=>x.n===n); return `<button class="slt" data-act="tool" data-n="${esc(n)}">${ICONS[t.i]({size:15})} ${esc(n)}</button>`; }).join('');
    return `<div class="wk-sec">
      <div class="wk-sechead"><div class="pm-eyebrow">Tools</div></div>
      <div class="wk-tools">${rows}<button class="slt ghost" data-act="tools-all">${ICONS.grid({size:15})} All 14 tools…</button></div>
    </div>`;
  }
  function todoSection(){
    const open = state.todo.filter(t=>!t.done).length, done = state.todo.filter(t=>t.done).length;
    let body;
    if (!state.todo.length){
      body = `<div class="wk-todo-empty">Add a concrete next step from a report or host response. Nothing is added automatically.</div>`;
    } else {
      body = state.todo.map((t,i)=>`<div class="wk-todoitem${t.done?' done':''}"><span class="tk" data-act="todo-tog" data-i="${i}">${ICONS.check({size:11,sw:3})}</span><span class="tt">${esc(t.text)}</span></div>`).join('');
    }
    return `<div class="wk-sec wk-todo">
      <div class="wk-sechead"><div class="pm-eyebrow">To-do list</div><span class="wk-secmeta">${open} open · ${done} done</span></div>
      ${body}
    </div>`;
  }
  function renderRail(){
    $('#wk-rail').innerHTML = excerptSection() + contextSection() + toolsSection() + todoSection();
  }

  /* ---------- center ---------- */
  function avatar(){ return `<div class="wk-av"><img src="assets/prose-minion-book.png" alt=""></div>`; }
  function renderCenter(){
    const c = $('#wk-center');
    if (state.transcript && state.transcript.length){
      const msgs = state.transcript.map(m => {
        if (m.who==='you') return `<div class="wk-msg you"><div class="wk-bubble"><div class="wk-who">You</div><div class="bd">${m.text}</div></div></div>`;
        const by = m.by || state.host;
        return `<div class="wk-msg bot">${avatar()}<div class="wk-bubble"><div class="wk-who"><span class="dot"></span>${esc(hostName(by))} · ${by===state.host?'host':'guest'}</div><div class="bd">${m.text}</div></div></div>`;
      }).join('');
      const parts = state.participants || [state.host];
      const partRow = `<div class="wk-parts"><span class="lab">In the room</span>${parts.map(id=>`<span class="wk-part"><span class="pav">${hostGlyphs(id,16)}</span>${esc(hostName(id))}<span class="role">${id===state.host?'host':'guest'}</span></span>`).join('')}</div>`;
      c.innerHTML = `<div class="wk-thread">
        <div class="wk-restore-note">${ICONS.refresh({size:15,sw:1.8})}<div><b>Session restored.</b> Your excerpt, context, the complete transcript, and every participant are back. Conversational memory isn't carried across — each persona starts the next turn fresh.</div></div>
        ${partRow}
        ${msgs}
        <div class="wk-divider"><hr><span>Previous session restored — transcript preserved · room memory not retained</span><hr></div>
      </div>`;
      c.scrollTop = c.scrollHeight;
    } else if (state.excerpt){
      c.innerHTML = `<div class="wk-empty"><div class="spk">${ICONS.sparkle({size:26,sw:1.6})}</div><h2>Ready when you are.</h2><p>Ask ${esc(hostName(state.host))} about the excerpt, or run a tool from the left. The excerpt stays pinned while the conversation grows here.</p></div>`;
    } else {
      c.innerHTML = `<div class="wk-empty"><div class="spk">${ICONS.sparkle({size:26,sw:1.6})}</div><h2>Pin an excerpt to start the Workshop.</h2><p>Paste text or pin a file on the left. The excerpt stays fixed while the conversation grows here.</p></div>`;
    }
  }

  /* ---------- composer ---------- */
  function renderComposer(){
    const measured = !state.restored && state.transcript && state.transcript.length;
    const ctx = measured
      ? `<div class="ctrack"><div class="cfill" style="width:39%"></div></div><span class="cnums"><b>59K</b> / 150K</span>`
      : `<div class="ctrack empty"></div><span class="cnote">Not measured yet — updates after the first reply</span>`;
    $('#wk-composer').innerHTML = `
      <div class="wk-ctxline"><span class="cdot"></span><span class="cname">${esc(hostName(state.host))} context</span>${ctx}</div>
      <div class="wk-composer">
        <div class="wk-cinput">Message ${esc(hostName(state.host))} about this excerpt…</div>
        <div class="wk-crow">
          <button class="wk-sq" data-act="ctx-file" title="Attach">${ICONS.plus({size:18})}</button>
          <div class="wk-acts">
            <button class="wk-abtn wk-modechip" data-act="convsettings" title="Conversation settings">${ICONS.scale({size:14,sw:1.6})}<b>${MODES[state.mode]}</b><span class="sub">${state.expr.toUpperCase()}</span>${state.profileShared?'<span class="prof" title="Profile shared"></span>':''}</button>
            <button class="wk-abtn" data-act="tools-all">${ICONS.grid({size:14,sw:1.7})}Tools</button>
            <button class="wk-abtn wk-wbtn" data-act="widgets" title="Open a widget">${ICONS.sparkle({size:14,sw:1.8})}Widgets</button>
            <button class="wk-send" data-act="send">${ICONS.send({size:16,sw:1.6})}</button>
          </div>
        </div>
      </div>
      <div class="wk-enter">Enter to send · <b>Shift+Enter</b> for a new line</div>`;
  }

  function render(){ renderSub(); renderHeaderCluster(); renderRail(); renderCenter(); renderComposer(); }

  /* ---------- toast ---------- */
  let toastT;
  function toast(msg, icon='check'){
    const el = $('#wk-toast');
    el.innerHTML = `${(ICONS[icon]||ICONS.check)({size:15})}<span>${esc(msg)}</span>`;
    el.classList.add('show'); clearTimeout(toastT);
    toastT = setTimeout(()=>el.classList.remove('show'), 2200);
  }

  /* ---------- excerpt demo set ---------- */
  function setExcerptDemo(){
    state.excerpt = {title:'Pentecost', source:'Drafts/chapter-5.8.md', version:2, words:2015, text:EXCERPT_TEXT};
    if (!state.context.length){
      state.context = [
        {kind:'text',   label:'testing…',                    words:1},
        {kind:'file',   label:'character-ava.md',            words:2738},
        {kind:'file',   label:'character-set-piece-moments.md', words:1908},
        {kind:'file',   label:'character-chen.md',           words:1252},
      ];
    }
    render();
  }

  /* =======================================================================
     MODALS
     ======================================================================= */
  function wkOpen(inner, cls){ cwOpen(inner); const m = document.querySelector('.cw-ov .cw-modal'); if (m && cls) m.classList.add(...cls.split(' ')); return m; }

  /* ---- host picker ---- */
  function buildHostPicker(){
    const root = document.createElement('div'); root.className='cw-sheet-wrap';
    root.appendChild(cwXBtn());
    const cards = HOST_ORDER.map(id=>{ const p=PERSONAS[id];
      return `<div class="hp-cell">
        <button class="hp-card${id===state.host?' sel':''}" data-host="${id}">
          <div class="hp-ic">${hostGlyphs(id,26)}</div>
          <div class="hp-name">${esc(p.name)}</div>
          <div class="hp-spec">${esc(p.spec)}</div>
          <div class="hp-desc">${esc(p.desc)}</div>
        </button>
        <button class="hp-more" data-more="${id}">More info ${ICONS.chevRight({size:13})}</button>
      </div>`;
    }).join('');
    root.insertAdjacentHTML('beforeend', `
      <div class="wk-mhead"><div class="wk-mkicker">Workshop host</div><h2>Choose your writing partner</h2><p class="wk-msub">Choose a lens before the conversation begins. Start a new session to change hosts later.</p></div>
      <div class="wk-sheet-body"><div class="hp-body"><div class="hp-grid">${cards}</div></div></div>`);
    root.addEventListener('click', e=>{
      const card = e.target.closest('[data-host]');
      if (card){ state.host = card.dataset.host; cwClose(); render(); toast('Host set to '+hostName(state.host), 'sparkle'); return; }
      const more = e.target.closest('[data-more]');
      if (more){ toast('Persona schematic — '+hostName(more.dataset.more), 'bot'); }
    });
    return root;
  }
  function openHostPicker(){ wkOpen(buildHostPicker(), 'xwide sheet'); }

  /* ---- conversation settings ---- */
  const EXPR = {subtle:['Subtle','Quieter delivery — fewer quirks and metaphors, same person and expertise.'], full:['Full','Their natural voice, tastes, trait tensions, and verbal palette without muting.'], amplified:['Amplified','Strongest authored differentiation — calibrated language and communication pressure.']};
  const DEPTH = {reserved:['Reserved','Responds to feelings and needs you state directly without unsolicited personal interpretation.'], attuned:['Attuned','Uses high emotional intelligence to notice likely immediate cues and adapt with humility.'], reflective:['Reflective','May connect the work with life experience you explicitly shared and invite deeper reflection.']};
  const MODEDESC = {analysis:['Analyze','Leads with the most important finding, traces evidence, offers next moves.'], balanced:['Balanced','A workshop exchange — one meaningful observation, mixed with real conversation.'], conversational:['Converse','Shorter, responsive turns that follow your thought — no forced reports.']};
  function segCards(group, map, cur){
    return Object.keys(map).map(k=>`<button class="segcard${k===cur?' sel':''}" data-${group}="${k}"><span class="sc-top">${ICONS.target({size:15})}<span class="sc-name">${map[k][0]}</span></span><span class="sc-desc">${map[k][1]}</span></button>`).join('');
  }
  function buildConvSettings(){
    const d = {mode:state.mode, expr:state.expr, depth:state.depth, carry:state.carryCues, shared:state.profileShared, addr:'', bio:''};
    const root = document.createElement('div'); root.className='cw-sheet-wrap';
    root.appendChild(cwXBtn());
    root.insertAdjacentHTML('beforeend', `
      <div class="wk-mhead"><div class="wk-mkicker">Workshop · Room settings</div><h2>Conversation settings</h2><p class="wk-msub">Choose how Workshop personas respond and what you explicitly share with them. Tools are unchanged.</p></div>
      <div class="cs-tabs"><button class="cs-tab on" data-tab="behavior">Behavior</button><button class="cs-tab" data-tab="profile">About you</button></div>
      <div class="wk-sheet-body">
        <div class="cs-pane on" data-pane="behavior">
          <div class="msec"><div class="msec-h"><span class="t">Response style</span><hr></div><div class="segcards" data-grp="mode">${segCards('mode',MODEDESC,d.mode)}</div><p class="msec-note">What you ask for always wins — “analyze this” gets analysis in any style.</p></div>
          <div class="msec"><div class="msec-h"><span class="t">Persona expression</span><hr></div><div class="segcards" data-grp="expr">${segCards('expr',EXPR,d.expr)}</div><p class="msec-note">Identity and craft expertise remain present at every level.</p></div>
          <div class="msec"><div class="msec-h"><span class="t">Relational depth</span><hr></div><div class="segcards" data-grp="depth">${segCards('depth',DEPTH,d.depth)}</div><p class="msec-note">A permission ceiling, not a requirement. Each persona decides when depth helps.</p></div>
          <div class="msec"><div class="msec-h"><span class="t">Session continuity</span><hr></div><div class="trow"><div class="trow-txt"><div class="trow-name">Carry cues through this session</div><div class="trow-desc">Let demonstrated preferences — like blunt critique or brief answers — shape later turns. Cleared when the session ends.</div></div><span class="tog${d.carry?' on':''}" data-tog="carry"><i></i></span></div></div>
        </div>
        <div class="cs-pane" data-pane="profile">
          <div class="trow" style="margin-top:20px"><div class="trow-txt"><div class="trow-name">Share this profile with Workshop personas</div><div class="trow-desc">When on, the room may use the details below to address you and add relevant context.</div></div><span class="tog${d.shared?' on':''}" data-tog="shared"><i></i></span></div>
          <div class="field"><label class="field-label">How should the room address you?</label><input class="tin" data-f="addr" maxlength="80" placeholder="e.g. Okey · Dr. Landers · “Okey is fine”"></div>
          <div class="field"><label class="field-label">What would you like the room to know about you?</label><textarea class="tar" data-f="bio" maxlength="1000" placeholder="A few enduring facts or preferences — not a résumé. The room treats this as background, never as instructions."></textarea></div>
          <div class="cs-notice">${ICONS.bot({size:15,sw:1.5})}<span>Stored with your global settings — ordinary settings data, <b>not a secret</b>. It's never copied into transcripts, saved sessions, or tools.</span></div>
        </div>
      </div>
      <div class="wk-sheet-foot"><span class="note">Applies the Behavior and About You drafts together to the active room.</span><button class="mbtn" data-close-cs>Cancel</button><button class="mbtn primary" data-apply-cs>Apply to next turn</button></div>`);
    root.querySelector('.cs-tabs').addEventListener('click', e=>{ const t=e.target.closest('[data-tab]'); if(!t) return;
      root.querySelectorAll('.cs-tab').forEach(x=>x.classList.toggle('on', x===t));
      root.querySelectorAll('.cs-pane').forEach(p=>p.classList.toggle('on', p.dataset.pane===t.dataset.tab));
      root.querySelector('.wk-sheet-body').scrollTop=0;
    });
    root.querySelectorAll('.segcards').forEach(sc=> sc.addEventListener('click', e=>{ const b=e.target.closest('[data-'+sc.dataset.grp+']'); if(!b) return; const grp=sc.dataset.grp; d[grp]=b.dataset[grp]; sc.querySelectorAll('.segcard').forEach(x=>x.classList.toggle('sel', x===b)); }));
    root.querySelectorAll('.tog').forEach(t=> t.addEventListener('click', ()=>{ const k=t.dataset.tog; d[k]=!d[k]; t.classList.toggle('on', d[k]); }));
    root.querySelector('[data-close-cs]').addEventListener('click', cwClose);
    root.querySelector('[data-apply-cs]').addEventListener('click', ()=>{ state.mode=d.mode; state.expr=d.expr; state.depth=d.depth; state.carryCues=d.carry; state.profileShared=d.shared && (root.querySelector('[data-f="addr"]').value.trim()||root.querySelector('[data-f="bio"]').value.trim()); cwClose(); render(); toast('Applied to next turn'); });
    return root;
  }
  function openConvSettings(){ wkOpen(buildConvSettings(), 'wide sheet'); }

  /* ---- choose from project (excerpt) ---- */
  const CFP_CATS = [
    {n:'Characters',           c:98, kb:'1079.2 KB'},
    {n:'Locations & Settings', c:26, kb:'143.3 KB'},
    {n:'Themes',               c:25, kb:'386.5 KB'},
    {n:'Things / Props',       c:13, kb:'60.9 KB'},
    {n:'Chapters & Scenes',    c:52, kb:'517.1 KB'},
    {n:'Manuscript',           c:1,  kb:'1.3 KB'},
    {n:'Project Brief',        c:3,  kb:'73.6 KB'},
    {n:'General References',    c:79, kb:'740.7 KB'},
  ];
  const CFP_FILES = ['Characters/Ava/ava-appearances.md|34.4 KB','Characters/Ava/ava-voice-guide.md|15.4 KB','Characters/Ava/character-ava.md|18.2 KB','Characters/Bradley/bradley-appearances.md|6.9 KB','Characters/Bradley/bradley-voice-guide.md|11.1 KB','Characters/Bradley/character-bradley.md|14.1 KB','Characters/character-set-piece-moments.md|12.5 KB','Characters/Chen/character-chen.md|9.0 KB','Characters/Chen/chen-appearances.md|5.5 KB','Characters/continuity-issues.md|13.7 KB','Characters/David/character-david.md|1.6 KB','Characters/Demonic-Horde/character-demonic-horde.md|2.3 KB','Characters/Doyle/character-doyle.md|3.4 KB','Characters/Drew/character-drew.md|1.7 KB'];
  function buildChooseProject(){
    const root = document.createElement('div'); root.className='cw-sheet-wrap';
    root.appendChild(cwXBtn());
    root.insertAdjacentHTML('beforeend', `
      <div class="wk-mhead"><div class="wk-mkicker">Set excerpt</div><h2>Choose from project</h2><p class="wk-msub">Pick one file to workshop — it becomes the working excerpt, head-sliced past the budget.</p></div>
      <div class="wk-sheet-body"><div class="cfp-body">
        <div class="cfp-search"><span class="si">${ICONS.search({size:16})}</span><input placeholder="Search configured resources…"><div class="cfp-seg"><button class="on" data-sm="names">Names</button><button data-sm="content">Names + content</button></div></div>
        <div class="cfp-view"></div>
      </div></div>
      <div class="wk-sheet-foot"><span class="note cfp-foot-note">Click a file to set it as the excerpt</span><button class="mbtn" data-close-cfp>Cancel</button></div>`);
    const view = root.querySelector('.cfp-view');
    const renderCats = () => {
      view.innerHTML = `<div class="cfp-cats">${CFP_CATS.map(c=>`<button class="cfp-cat" data-cat="${esc(c.n)}"><div class="cn">${esc(c.n)}</div><div class="cm">${c.c} file${c.c===1?'':'s'} · ${c.kb}</div></button>`).join('')}</div>
        <button class="cfp-explore" data-explore>${ICONS.doc({size:16})}<span>Explore project folders… <span class="h">opens the system picker; budget checked on add</span></span></button>`;
    };
    const renderFiles = (cat) => {
      view.innerHTML = `<div class="cfp-nav"><button class="cfp-back" data-back>${ICONS.chevRight({size:12})}<span style="transform:scaleX(-1);display:inline-block">${ICONS.chevRight({size:12})}</span>Back</button><span class="cfp-crumb">${esc(cat)}</span></div>
        <div class="cfp-files">${CFP_FILES.map(f=>{const[p,w]=f.split('|');return `<button class="cfp-file" data-file="${esc(p)}"><span class="fp">${esc(p)}</span><span class="fw">${w}</span></button>`;}).join('')}</div>`;
    };
    renderCats();
    root.querySelector('.cfp-seg').addEventListener('click', e=>{ const b=e.target.closest('[data-sm]'); if(!b) return; root.querySelectorAll('.cfp-seg button').forEach(x=>x.classList.toggle('on', x===b)); });
    view.addEventListener('click', e=>{
      if (e.target.closest('[data-cat]')) return renderFiles(e.target.closest('[data-cat]').dataset.cat);
      if (e.target.closest('[data-back]')) return renderCats();
      if (e.target.closest('[data-explore]')) return toast('Opening system file picker…','doc');
      const f = e.target.closest('[data-file]');
      if (f){ cwClose(); const base=f.dataset.file.split('/').pop(); state.excerpt={title:base.replace(/\.md$/,''), source:'Drafts/'+base, version:1, words:2015, text:EXCERPT_TEXT}; render(); toast('Excerpt set — '+base,'pin'); }
    });
    root.querySelector('[data-close-cfp]').addEventListener('click', cwClose);
    return root;
  }
  function openChooseProject(){ wkOpen(buildChooseProject(), 'wide sheet'); }

  /* ---- tools modal ---- */
  function openTools(){
    const el = document.createElement('div'); el.className='cw-browser';
    el.appendChild(cwXBtn());
    el.insertAdjacentHTML('beforeend', `<div class="cw-eyebrow">Prose Excerpt Assistant</div><h3>Writing tools</h3><p class="bsub">Pick an analysis — each runs on your excerpt with the context brief attached.</p>`);
    ['Primary','Craft & Voice','Technical'].forEach(g=>{
      el.insertAdjacentHTML('beforeend', `<div class="cw-mgh"><span class="t">${g}</span><hr></div>`);
      TOOLS.filter(t=>t.g===g).forEach(t=>{
        const b=document.createElement('button'); b.className='cw-brow';
        b.innerHTML=`<span class="ic">${ICONS[t.i]({size:16})}</span><span class="bt"><span class="nm">${t.n}</span><span class="bl">${t.d}</span></span>`;
        b.addEventListener('click', ()=>{ cwClose(); toast(t.n+' — running on excerpt','sparkle'); });
        el.appendChild(b);
      });
    });
    wkOpen(el, 'wide');
  }
  function openWidgets(){
    if (typeof buildWidgetBrowser !== 'function'){ toast('Widgets browser'); return; }
    cwOpen(buildWidgetBrowser(w=>{ cwClose(); toast('Opening '+w.name+'…','sparkle'); }, true), true);
  }

  /* =======================================================================
     WIRING
     ======================================================================= */
  function closeMenus(except){ document.querySelectorAll('.wk-menu.open').forEach(m=>{ if(m!==except) m.classList.remove('open'); }); }
  function wire(){
    document.addEventListener('click', e=>{
      const act = e.target.closest('[data-act]');
      // menu outside-close
      if (!e.target.closest('.wk-menuwrap')) closeMenus();
      if (!act) return;
      const a = act.dataset.act;
      if (a==='host') return openHostPicker();
      if (a==='sessions'){ const m=$('#wk-sess-menu'); const wasOpen=m.classList.contains('open'); closeMenus(); if(!wasOpen){ if(window.PMSessions) PMSessions.renderMenu(m); m.classList.add('open'); } return; }
      if (a==='model'){ const m=$('#wk-model-menu'); const wasOpen=m.classList.contains('open'); closeMenus(); m.classList.toggle('open', !wasOpen); return; }
      if (a==='setmodel'){ state.model=act.dataset.v; closeMenus(); render(); toast('Model — '+state.model,'bot'); return; }
      if (a==='ex-type'){ setExcerptDemo(); toast('Excerpt pinned — Pentecost','pin'); return; }
      if (a==='ex-pick') return openChooseProject();
      if (a==='ctx-file'){ addCtxDemo('file'); return; }
      if (a==='ctx-text'){ addCtxDemo('text'); return; }
      if (a==='ctx-wizard'){ addCtxDemo('wizard'); return; }
      if (a==='ctx-rm'){ state.context.splice(+act.dataset.i,1); render(); return; }
      if (a==='tool' || a==='tools-all') return openTools();
      if (a==='convsettings') return openConvSettings();
      if (a==='widgets') return openWidgets();
      if (a==='todo-tog'){ const t=state.todo[+act.dataset.i]; if(t){ t.done=!t.done; render(); } return; }
      if (a==='send'){ toast('Send is disabled in this mock','send'); return; }
    });
  }
  // context quick-adds (demo)
  function addCtxDemo(kind){
    if (kind==='text'){ state.context.push({kind:'text', label:'Note…', words:120}); toast('Context added — text note'); }
    else if (kind==='file'){ const f={kind:'file',label:'chapter-5.7.md',words:1840}; if(!state.context.some(x=>x.label===f.label)) state.context.push(f); toast('Context added — chapter-5.7.md','doc'); }
    else { const picks=[{kind:'wizard',label:'kayla-voice-guide.md',words:980},{kind:'wizard',label:'timeline.md',words:2300}].filter(p=>!state.context.some(x=>x.label===p.label)); picks.forEach(p=>state.context.push(p)); toast('Context wizard added '+picks.length+' file'+(picks.length===1?'':'s'),'sparkle'); }
    render();
  }

  /* ---------- session hooks (for pm-sessions.js) ---------- */
  function loadSession(sess){
    state.excerpt = sess.excerpt ? {...sess.excerpt} : null;
    state.context = (sess.context||[]).map(x=>({...x}));
    state.host = sess.host || 'jill';
    state.mode = sess.mode || 'balanced';
    state.expr = sess.expr || 'amplified';
    state.todo = (sess.todo||[]).map(x=>({...x}));
    state.transcript = (sess.transcript||[]).map(x=>({...x}));
    state.participants = sess.participants ? [...sess.participants] : [sess.host||'jill'];
    state.restored = true;
    state.session = {name: sess.title};
    render();
    toast('Opened — '+sess.title,'cards');
  }
  function newSession(){
    state.excerpt=null; state.context=[]; state.host='jill'; state.mode='balanced'; state.expr='amplified'; state.depth='reflective';
    state.todo=[]; state.transcript=null; state.participants=null; state.restored=false; state.session=null; state.profileShared=false;
    render(); toast('New session started','refresh');
  }
  function currentSnapshot(){
    return {
      excerpt: state.excerpt, context: state.context, host: state.host,
      mode: state.mode, expr: state.expr, todo: state.todo,
      turns: state.transcript ? state.transcript.length : 0,
      participants: state.participants || [state.host],
      hostName: hostName(state.host),
    };
  }
  function setSessionName(n){ state.session = n ? {name:n} : state.session; render(); }

  function init(){
    renderTopIcons(); render(); wire();
  }
  document.addEventListener('DOMContentLoaded', init);

  return { PERSONAS, HOST_ORDER, personIc, hostGlyphs, hostName, fmt, esc, state,
           render, toast, loadSession, newSession, currentSnapshot, setSessionName,
           openBrowserFallback: ()=>window.PMSessions&&PMSessions.openBrowser(),
           MODES };
})();
window.PMW = PMW;
