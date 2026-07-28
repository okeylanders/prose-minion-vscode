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

  const CTX_NOTE = `# Kayla — running notes

She **does not** believe what she says in the corridor. Voice should tighten, not rise.

- Nervous tell: picks at the cuff of her sleeve
- Never uses Nate's full name in front of the others
- Post-auditorium, she stops narrating her own fear

> "They can't make us do this" is bravado for Nate's benefit.`;
  const CTX_WIZ = `# kayla-voice-guide.md

*Suggested by the context wizard — excerpted.*

Kayla's diction is short, concrete, and Anglo-Saxon under pressure. She reaches for **understatement** when frightened and for questions when she wants control.

1. Clipped sentences when the stakes are physical
2. Longer, looser lines when she is safe or performing ease
3. Rarely finishes a sentence someone else started`;
  const MODES = {analysis:'Analyze', balanced:'Balanced', conversational:'Converse'};
  const MODELS = ['Arcee Trinity Large Thinking','Claude Opus 4.8','Claude Sonnet 4.6','GPT-5.2','Gemini 3.5 Pro'];

  /* ---------- state ---------- */
  const state = {
    excerpt: null,            // {title, source, version, words, text}
    shelved: null,            // excerpt set aside when the writer switches to open conversation
    scope: null,              // null = choosing a path · 'excerpt' · 'open'
    context: [],              // [{kind,label,words}]
    host: 'jill',
    mode: 'balanced', expr: 'amplified', depth: 'reflective',
    profileShared: false, carryCues: true,
    todo: [],
    transcript: null,         // when restored: [{who,text,by}]
    participants: null,       // [personaId] restored in the room
    restored: false,
    session: null,            // {name}
    pins: {influence:[], decisions:[]},   // standing influence chips + pinned decisions
    model: 'Arcee Trinity Large Thinking',
    processed: 0,
    tabs: [],                 // open editor tabs (file names)
  };
  const BUDGET = 35000;
  const START_STR = (()=>{ const d=new Date(); const s=d.toLocaleString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric',hour:'numeric',minute:'2-digit',second:'2-digit',timeZoneName:'short'}); const tz=(Intl.DateTimeFormat().resolvedOptions().timeZone||'').toUpperCase(); return (s+(tz?' ('+tz+')':'')).toUpperCase(); })();
  const ctxTotal = () => state.context.reduce((a,x)=>a+x.words,0);

  /* ---------- icon helpers ---------- */
  const personIc = (o={}) => IC('<circle cx="12" cy="8" r="3.4"/><path d="M5.3 20c0-3.9 3-6.5 6.7-6.5s6.7 2.6 6.7 6.5"/>', Object.assign({sw:1.7}, o));
  function hostGlyphs(id, size){
    const p = PERSONAS[id]; const g = size >= 24 ? Math.round(size*0.6) : Math.round(size*0.68);
    return personIc({size,sw:1.7}) + `<span class="glyph">${(ICONS[p.glyph]||ICONS.sparkle)({size:g,sw:2})}</span>`;
  }
  function hostName(id){ return PERSONAS[id].name; }

  /* ---------- editor tabs ---------- */
  function renderTabs(){
    const files = state.tabs.map(f=>`<button class="wk-tab idle" data-act="tab-go" data-f="${esc(f)}">${ICONS.doc({size:12})} ${esc(f)} <span class="x" data-act="tab-close" data-f="${esc(f)}" role="button" tabindex="0" aria-label="Close ${esc(f)}">${ICONS.x({size:12,sw:1.8})}</span></button>`).join('');
    $('#wk-tabs').innerHTML = `<div class="wk-tab"><span class="ic"><img src="assets/prose-minion-book.png" alt=""></span> Workshop <span class="x">${ICONS.x({size:12,sw:1.8})}</span></div>${files}`;
  }
  function openEditorTab(file){
    if (!state.tabs.includes(file)) state.tabs.push(file);
    renderTabs(); toast(file+' — opened in an editor tab','doc');
  }

  /* ---------- header ---------- */
  function renderTopIcons(){
    $('#wk-topicons').innerHTML =
      `<span class="spark" title="Prose Minion">${ICONS.sparkle({size:15,sw:1.8})}</span>`+
      `<span title="Assistant">${ICONS.bot({size:16,sw:1.6})}</span>`+
      `<span title="Toggle panel">${ICONS.panelRight({size:15,sw:1.6})}</span>`+
      `<span title="More">${ICONS.list({size:15,sw:1.6})}</span>`;
  }
  function renderSub(){
    const e = state.excerpt;
    $('#wk-sub').innerHTML = e
      ? `${ICONS.doc({size:12})}<span>${esc(e.source)}</span> · <span class="v">v${e.version}</span> · ${fmt(e.words)} words`
      : state.scope==='open'
        ? `${ICONS.dialogue({size:12})}<span>Open conversation · No excerpt yet</span>`
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
    if (!state.excerpt && state.scope==='open'){
      return `<div class="wk-sec">
        <div class="wk-sechead"><div class="pm-eyebrow">${ICONS.doc({size:12})} Excerpt</div><span class="stat-chip open">OPEN CONVERSATION</span></div>
        <div class="wk-noex">
          <div class="nt">${ICONS.doc({size:14})} No excerpt yet</div>
          <div class="nd">${esc(hostName(state.host))} hasn't read any pages. Add one whenever you're ready — this conversation stays, and the session keeps its history. Context attachments below still ride along with every message.</div>
          <div class="sbtnrow">
            <button class="sbtn grow" data-act="ex-type">${ICONS.pen({size:13})} Paste or type</button>
            <button class="sbtn grow" data-act="ex-pick">${ICONS.doc({size:13})} From project…</button>
          </div>
          ${state.shelved?`<div class="sbtnrow"><button class="sbtn grow" data-act="ex-repin">${ICONS.pin({size:13})} Re-pin ${esc(state.shelved.title)} v${state.shelved.version}</button></div>`:''}
        </div>
      </div>`;
    }
    if (!state.excerpt){
      return `<div class="wk-sec">
        <div class="wk-sechead"><div class="pm-eyebrow">${ICONS.doc({size:12})} Excerpt</div></div>
        ${state.shelved?`<button class="sbtn grow" data-act="ex-continue" style="margin-bottom:9px">${ICONS.pin({size:13})} Continue with ${esc(state.shelved.title)} v${state.shelved.version}</button>`:''}
        <div class="btnstack">
          <button class="bigbtn" data-act="ex-type">${ICONS.pen({size:18})}Paste or type<span class="sub">verified if it matches your editor selection</span></button>
          <button class="bigbtn" data-act="ex-pick">${ICONS.doc({size:18})}Choose from project…<span class="sub">reads the file, head-slices past 10,000 words</span></button>
        </div>
        <div class="cap">The excerpt is the text this room is workshopping.</div>
        <div class="wk-or"><hr><span>or</span><hr></div>
        <button class="chatentry" data-act="open-chat">
          <span class="ci">${ICONS.dialogue({size:16,sw:1.7})}</span>
          <span><span class="cn">Start a conversation</span><span class="cs">Just chatting / brainstorming — no excerpt needed.</span></span>
        </button>
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
      ${state.scope==='open'?`<button class="chatentry mini" data-act="set-aside"><span class="ci">${ICONS.dialogue({size:15,sw:1.7})}</span><span><span class="cn">Unpin — back to open conversation</span><span class="cs">Shelves the passage and keeps this conversation. ${esc(hostName(state.host))} stops treating it as read.</span></span></button>`:`<button class="chatentry mini" data-act="set-aside"><span class="ci">${ICONS.dialogue({size:15,sw:1.7})}</span><span><span class="cn">Set this aside — just chat</span><span class="cs">Keeps the passage on the shelf. ${esc(hostName(state.host))} stops treating it as read.</span></span></button>`}
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
      const pills = state.context.map((x,i)=>`<span class="pill ${x.kind}">${ICONS[x.kind==='file'?'doc':x.kind==='wizard'?'sparkle':'list']({size:12})}<button class="pl" data-act="ctx-open" data-i="${i}" title="${x.kind==='file'?'Open in an editor tab':'Edit or preview'}">${esc(x.label)}</button><span class="ps">${fmt(x.words)} words</span><button class="px" data-act="ctx-rm" data-i="${i}" aria-label="Remove">${ICONS.x({size:9,sw:2.4})}</button></span>`).join('');
      body = `<div class="wk-pills">${pills}</div>
      <div class="sbtnrow">
        <button class="sbtn" data-act="ctx-text">${ICONS.list({size:13})} Add text</button>
        <button class="sbtn" data-act="ctx-file">${ICONS.doc({size:13})} Add from project…</button>
        <button class="sbtn" data-act="ctx-wizard">${ICONS.sparkle({size:13})} Context wizard</button>
      </div>${meter}
      <div class="cap">Files open in an editor tab · text and wizard notes open for edit or preview.</div>`;
    }
    return `<div class="wk-sec">
      <div class="wk-sechead"><div class="pm-eyebrow">${ICONS.cards({size:12})} Context</div>${has?`<span class="wk-secmeta">${state.context.length} attachment${state.context.length===1?'':'s'}</span>`:''}</div>
      ${body}
    </div>`;
  }
  function toolsSection(){
    const locked = !state.excerpt;
    const rows = RAIL_TOOLS.map(n=>{ const t=TOOLS.find(x=>x.n===n);
      return locked
        ? `<button class="slt locked" data-act="tools-locked" aria-disabled="true" title="Add an excerpt to use analysis tools">${ICONS[t.i]({size:15})} ${esc(n)}<span class="lk">needs excerpt</span></button>`
        : `<button class="slt" data-act="tool" data-n="${esc(n)}">${ICONS[t.i]({size:15})} ${esc(n)}</button>`;
    }).join('');
    return `<div class="wk-sec">
      <div class="wk-sechead"><div class="pm-eyebrow">Tools</div>${locked?'<span class="wk-secmeta">unavailable</span>':''}</div>
      <div class="wk-tools">${rows}<button class="slt ghost${locked?' locked':''}" data-act="${locked?'tools-locked':'tools-all'}"${locked?' aria-disabled="true"':''}>${ICONS.grid({size:15})} All 14 tools…</button></div>
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
    } else if (state.scope==='open'){
      const h = esc(hostName(state.host));
      const strip = state.excerpt
        ? `<div class="wk-scopestrip passage"><span class="sdot"></span><span class="st">Passage session · ${esc(state.excerpt.title)} v${state.excerpt.version}</span><span class="sn">Analysis tools available</span><button class="sbtn" data-act="set-aside">${ICONS.dialogue({size:13})} Unpin excerpt</button></div>`
        : `<div class="wk-scopestrip"><span class="sdot"></span><span class="st">Open conversation · No excerpt yet</span><span class="sn">${h} hasn't read any pages</span><button class="sbtn" data-act="ex-type">${ICONS.plus({size:13})} Add excerpt</button></div>`;
      const trans = state.excerpt
        ? `<div class="wk-divider ctx"><hr><span>Excerpt added · ${esc(state.excerpt.title)} v${state.excerpt.version} — same session, conversation retained</span><hr></div>
           <div class="wk-openstart"><div class="ok">Scope changed</div><h3>${h} can read the passage now.</h3><p>Everything you've said so far is still here. Analysis tools have unlocked on the left, and the excerpt stays pinned while the conversation continues.</p></div>`
        : '';
      c.innerHTML = `<div class="wk-thread">
        ${strip}
        <div class="wk-openstart">
          <div class="ok">Session scope · Open conversation</div>
          <h3>Open conversation with ${h}.</h3>
          <p>No pages attached — ${h} hasn't read anything yet, and won't pretend to. Plan a scene, untangle a character, discuss craft, or get to know your writing partner. Project context you attach still rides along; only the excerpt is missing.</p>
          <div class="wk-starters">
            <button class="starter" data-act="starter">Help me plan the next scene</button>
            <button class="starter" data-act="starter">Something's off about Kayla</button>
            <button class="starter" data-act="starter">How do you handle a time skip?</button>
            <button class="starter" data-act="starter">Tell me how you read</button>
          </div>
        </div>
        ${trans}
      </div>`;
    } else if (state.scope==='excerpt' && state.excerpt){
      c.innerHTML = `<div class="wk-empty"><div class="spk">${ICONS.sparkle({size:26,sw:1.6})}</div><h2>Ready when you are.</h2><p>Ask ${esc(hostName(state.host))} about the excerpt, or run a tool from the left. The excerpt stays pinned while the conversation grows here.</p>
        <div class="wk-changemind">Changed your mind? <button data-act="set-aside">${ICONS.dialogue({size:13})} Just chatting / brainstorming</button></div></div>`;
    } else {
      const h = esc(hostName(state.host));
      const carry = state.excerpt || state.shelved;
      const cont = carry
        ? `<button class="pbtn solid" data-act="ex-continue">${ICONS.pin({size:14})} Continue with current excerpt</button>
           <div class="pcarry">${esc(carry.title)} v${carry.version} · ${esc(carry.source)} · ${fmt(carry.words)} words</div>`
        : '';
      c.innerHTML = `<div class="wk-first">
        <div class="fspk">${ICONS.sparkle({size:24,sw:1.6})}</div>
        <h2>What are we making today?</h2>
        <p class="fsub">Two ways in. Both open a real session with ${h} — pick the one that matches where the work is right now.</p>
        <div class="wk-paths">
          <div class="pathcard">
            <div class="ph"><span class="pic">${ICONS.doc({size:16,sw:1.7})}</span><span><span class="pt">Workshop an excerpt</span><span class="pk">Passage session</span></span></div>
            <div class="pd">Bring in a passage for close reading, analysis, and writing tools. Talk through the analysis in chat with ${h} or other persona hosts — you can even invite multiple hosts to the chat.</div>
            <div class="pacts">
              ${cont}
              <button class="pbtn${carry?'':' solid'}" data-act="ex-type">${ICONS.pen({size:14})} Paste or type…</button>
              <button class="pbtn" data-act="ex-pick">${ICONS.doc({size:14})} Choose from project…</button>
            </div>
            <div class="pnote">All 14 tools available · guests can be invited</div>
          </div>
          <div class="pathcard chat">
            <div class="ph"><span class="pic">${ICONS.dialogue({size:16,sw:1.7})}</span><span><span class="pt">Just chatting / brainstorming</span><span class="pk">Open conversation</span></span></div>
            <div class="pd">Talk through an idea, scene, character, or craft problem. You can add pages later.</div>
            <div class="pacts">
              <button class="pbtn calm" data-act="open-chat">${ICONS.dialogue({size:14})} Start a conversation</button>
            </div>
            <div class="pnote">No excerpt needed · context still attaches · analysis tools stay off until you add one</div>
          </div>
        </div>
        <div class="ffoot">Host for either path: <b>${h} · ${esc(PERSONAS[state.host].spec)}</b> — <span class="acc">Or select another host up top.</span></div>
        ${(state.excerpt||state.shelved||state.context.length)?`<div class="wk-resetrow"><button class="wk-reset" data-act="reset-ec">${ICONS.x({size:13,sw:2.2})} Reset excerpt and context<span class="d">${(state.excerpt||state.shelved)?'1 excerpt':'no excerpt'} · ${state.context.length} attachment${state.context.length===1?'':'s'}</span></button></div>`:''}
        <div class="wk-started"><hr><span>Session started ${START_STR}.</span><hr></div>
      </div>`;
    }
  }

  /* ---------- composer ---------- */
  function renderComposer(){
    const measured = !state.restored && state.transcript && state.transcript.length;
    const h = esc(hostName(state.host));
    const openNoEx = state.scope==='open' && !state.excerpt;
    const ctx = measured
      ? `<div class="ctrack"><div class="cfill" style="width:39%"></div></div><span class="cnums"><b>59K</b> / 150K</span>`
      : `<div class="ctrack empty"></div><span class="cnote">Not measured yet — updates after the first reply</span>`;
    const lead = openNoEx
      ? `<span class="cscope"><i></i>Open conversation · No excerpt yet</span>`
      : `<span class="cdot"></span><span class="cname">${h} context</span>`;
    const placeholder = openNoEx
      ? `What would you like to brainstorm with ${h}?`
      : state.scope==='open'
        ? `Message ${h} — excerpt now attached…`
        : state.scope==='excerpt' || (state.transcript && state.transcript.length)
          ? `Message ${h} about this excerpt…`
          : `Pick a starting path above to begin…`;
    const toolsBtn = state.excerpt
      ? `<button class="wk-abtn" data-act="tools-all">${ICONS.grid({size:14,sw:1.7})}Tools</button>`
      : `<button class="wk-abtn off" data-act="tools-locked" aria-disabled="true" title="Add an excerpt to use analysis tools">${ICONS.grid({size:14,sw:1.7})}Tools</button>`;
    $('#wk-composer').innerHTML = `
      ${window.PMPins?PMPins.railHTML(state):''}
      <div class="wk-ctxline">${lead}${ctx}</div>
      <div class="wk-composer">
        <div class="wk-cinput">${placeholder}</div>
        <div class="wk-crow">
          <button class="wk-sq" data-act="ctx-file" title="Attach">${ICONS.plus({size:18})}</button>
          ${openNoEx?`<button class="wk-abtn" data-act="ex-type" title="Add an excerpt to this session">${ICONS.doc({size:14})}Add excerpt</button>`:''}
          <div class="wk-acts">
            <button class="wk-abtn wk-modechip" data-act="convsettings" title="Conversation settings">${ICONS.scale({size:14,sw:1.6})}<b>${MODES[state.mode]}</b><span class="sub">${state.expr.toUpperCase()}</span>${state.profileShared?'<span class="prof" title="Profile shared"></span>':''}</button>
            ${toolsBtn}
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

  /* ---------- excerpt apply / demo set ---------- */
  function applyExcerpt(ex, note){
    const cont = state.scope==='open';
    state.excerpt = ex;
    state.shelved = null;
    state.scope = cont ? 'open' : 'excerpt';
    if (!state.context.length) seedContext();
    render();
    toast(note || (cont ? 'Excerpt added — conversation kept' : 'Excerpt pinned — '+ex.title), 'pin');
  }
  function seedContext(){
    state.context = [
      {kind:'text',   label:'Kayla — running notes',           words:41, text:CTX_NOTE},
      {kind:'file',   label:'character-ava.md',               words:2738},
      {kind:'file',   label:'character-set-piece-moments.md', words:1908},
      {kind:'file',   label:'character-chen.md',              words:1252},
    ];
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
      if (f){ cwClose(); const base=f.dataset.file.split('/').pop(); applyExcerpt({title:base.replace(/\.md$/,''), source:'Drafts/'+base, version:1, words:2015, text:EXCERPT_TEXT}, 'Excerpt set — '+base); }
    });
    root.querySelector('[data-close-cfp]').addEventListener('click', cwClose);
    return root;
  }
  function openChooseProject(){ wkOpen(buildChooseProject(), 'wide sheet'); }

  /* ---- shared text sheet: Edit │ Preview (formatted, read-only) ---- */
  const wordsIn = s => s.trim() ? s.trim().split(/\s+/).length : 0;
  function mdToHtml(src){
    const blocks = esc(src).replace(/\r/g,'').split(/\n{2,}/);
    const inline = t => t
      .replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>')
      .replace(/(^|[\s(])\*([^*\n]+)\*/g,'$1<em>$2</em>')
      .replace(/`([^`]+)`/g,'<code>$1</code>')
      .replace(/\n/g,'<br>');
    return blocks.map(b=>{
      const t = b.trim(); if (!t) return '';
      const h = t.match(/^(#{1,4})\s+(.*)$/);
      if (h) return `<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`;
      if (/^&gt;\s?/.test(t)) return `<blockquote>${inline(t.replace(/^&gt;\s?/gm,''))}</blockquote>`;
      if (/^([-*]|\d+\.)\s/.test(t)){
        const ol = /^\d+\.\s/.test(t);
        const items = t.split('\n').map(l=>l.replace(/^([-*]|\d+\.)\s+/,'')).map(l=>`<li>${inline(l)}</li>`).join('');
        return `<${ol?'ol':'ul'}>${items}</${ol?'ol':'ul'}>`;
      }
      if (/^(-{3,}|\*{3,})$/.test(t)) return '<hr>';
      return `<p>${inline(t)}</p>`;
    }).join('');
  }
  function openTextSheet(o){
    const root = document.createElement('div'); root.className='cw-sheet-wrap';
    root.appendChild(cwXBtn());
    root.insertAdjacentHTML('beforeend', `
      <div class="wk-mhead"><div class="wk-mkicker">${esc(o.kicker)}</div><h2>${esc(o.title)}</h2><p class="wk-msub">${o.sub}</p></div>
      <div class="cs-tabs ts-tabs"><button class="cs-tab on" data-t="edit">${esc(o.editLabel||'Edit')}</button><button class="cs-tab" data-t="preview">Preview</button><span class="ts-hint">Preview shows formatted output · read-only</span></div>
      <div class="wk-sheet-body">
        <div class="px-body ts-pane on" data-p="edit">
          <textarea class="px-ta" placeholder="${esc(o.placeholder||'')}" aria-label="${esc(o.title)}"></textarea>
          <div class="px-meta"><span class="wc">0 words</span><span>${o.meta||''}</span></div>
        </div>
        <div class="px-body ts-pane" data-p="preview">
          <div class="ts-prev" tabindex="0" aria-label="Formatted preview"></div>
          <div class="px-meta"><span class="wc">0 words</span><span>Markdown rendered as the room will read it</span></div>
        </div>
      </div>
      <div class="wk-sheet-foot"><span class="note">${o.foot||''}</span><button class="mbtn" data-close>Close</button><button class="mbtn primary" data-apply disabled>${esc(o.applyLabel||'Apply')}</button></div>`);
    const ta = root.querySelector('.px-ta'), prev = root.querySelector('.ts-prev'), ap = root.querySelector('[data-apply]');
    ta.textContent = o.value || ''; ta.value = o.value || '';
    const sync = () => {
      const n = wordsIn(ta.value);
      root.querySelectorAll('.wc').forEach(w=>w.textContent = fmt(n)+' word'+(n===1?'':'s'));
      prev.innerHTML = n ? mdToHtml(ta.value) : `<div class="ts-none">Nothing to preview yet.</div>`;
      ap.disabled = !n;
    };
    ta.addEventListener('input', sync); sync();
    root.querySelector('.ts-tabs').addEventListener('click', e=>{
      const b = e.target.closest('[data-t]'); if(!b) return;
      root.querySelectorAll('.cs-tab').forEach(x=>x.classList.toggle('on', x===b));
      root.querySelectorAll('.ts-pane').forEach(p=>p.classList.toggle('on', p.dataset.p===b.dataset.t));
      if (b.dataset.t==='edit') ta.focus(); else prev.focus();
    });
    root.addEventListener('click', e=>{
      if (e.target.closest('[data-sample]')){ ta.value = EXCERPT_TEXT; sync(); ta.focus(); }
      if (e.target.closest('[data-pick]')){ cwClose(); openChooseProject(); }
    });
    root.querySelector('[data-close]').addEventListener('click', cwClose);
    ap.addEventListener('click', ()=>{ const v = ta.value; cwClose(); o.onApply(v); });
    wkOpen(root, 'wide sheet');
    setTimeout(()=>ta.focus(), 40);
  }
  function openPaste(){
    const cont = state.scope==='open';
    openTextSheet({
      kicker: cont ? 'Add excerpt to this conversation' : 'Set excerpt',
      title: 'Paste or type the passage',
      sub: cont ? `This conversation stays exactly where it is — ${esc(hostName(state.host))} simply gains the pages and the analysis tools unlock.` : 'This becomes the working excerpt for the session. Verified when it matches your editor selection.',
      placeholder: 'Paste or type the passage you want to workshop…',
      meta: 'Head-sliced past 10,000 words · <button class="lnk" data-sample>paste sample passage</button>',
      foot: 'Rather pick a file? <button class="lnk" data-pick>Choose from project…</button>',
      applyLabel: 'Apply excerpt',
      onApply(t){
        const sample = t.trim()===EXCERPT_TEXT.trim();
        applyExcerpt(sample
          ? {title:'Pentecost', source:'Drafts/chapter-5.8.md', version:2, words:2015, text:EXCERPT_TEXT}
          : {title:'Pasted passage', source:'pasted text', version:1, words:wordsIn(t), text:t});
      },
    });
  }
  /* ---- context text: same sheet for add, edit, and wizard output ---- */
  const CTX_KIND = {text:'Text note', wizard:'Wizard suggestion', file:'Project file'};
  function openCtxText(i){
    const item = i==null ? null : state.context[i];
    const wiz = item && item.kind==='wizard';
    openTextSheet({
      kicker: item ? 'Context · '+CTX_KIND[item.kind] : 'Context · Text note',
      title: item ? item.label : 'Add a text note',
      sub: wiz
        ? 'Suggested by the context wizard — yours to edit, preview, or remove. Nothing is sent until you keep it.'
        : 'Context rides along with every message, to every participant — in passage sessions and open conversations alike.',
      placeholder: 'Notes, a character sheet, continuity you want the room to hold…',
      value: item ? (item.text||'') : '',
      meta: 'Counts against the shared context budget',
      foot: wiz ? 'Edits apply to this session only — the source file is untouched.' : '',
      applyLabel: item ? 'Save changes' : 'Add to context',
      onApply(t){
        const words = wordsIn(t);
        const label = (t.trim().split('\n')[0]||'Text note').replace(/^#+\s*/,'').slice(0,38) || 'Text note';
        if (item){ item.text=t; item.words=words; if(item.kind==='text') item.label=label; render(); toast('Context updated — '+item.label); }
        else { state.context.push({kind:'text', label, words, text:t}); render(); toast('Context added — '+label); }
      },
    });
  }

  /* ---- tools modal ---- */
  const TOOL_GDESC = {
    'Primary':'The daily passes — the six the rail keeps at hand.',
    'Craft & Voice':'How it sounds and how it’s built.',
    'Technical':'Mechanics, continuity, and fresh eyes.'
  };
  function openTools(){
    const el = cwSheetBrowser({
      kicker:'Prose Excerpt Assistant', title:'Writing tools', noun:'tool', verb:'Run',
      sub:'Each runs <b>once</b> on your excerpt with the context briefs attached — the result lands in the thread as a visible event, in '+esc(hostName(state.host))+'’s voice.',
      emptyNote:'Select a tool — one run on the excerpt, one visible result.',
      groups:['Primary','Craft & Voice','Technical'].map(g=>({name:g, desc:TOOL_GDESC[g], items:TOOLS.filter(t=>t.g===g).map(t=>({id:t.n, icon:t.i, name:t.n, blurb:t.d, live:true, cost:'one run on the excerpt · lands in the thread'}))})),
      inModal:true,
      onLaunch:t=>{ cwClose(); toast(t.name+' — running on excerpt','sparkle'); }
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
    document.addEventListener('keydown', e=>{
      if (e.key!=='Enter' && e.key!==' ') return;
      const x = e.target.closest && e.target.closest('[data-act="tab-close"]');
      if (!x) return;
      e.preventDefault(); e.stopPropagation();
      state.tabs = state.tabs.filter(f=>f!==x.dataset.f); renderTabs();
    });
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
      if (a==='ex-type') return openPaste();
      if (a==='ex-pick') return openChooseProject();
      if (a==='ex-continue'){ if(state.shelved && !state.excerpt) state.excerpt=state.shelved; state.shelved=null; state.scope='excerpt'; render(); toast('Continuing with '+state.excerpt.title+' v'+state.excerpt.version,'pin'); return; }
      if (a==='ex-repin'){ state.excerpt=state.shelved; state.shelved=null; render(); toast('Excerpt re-pinned — conversation kept','pin'); return; }
      if (a==='set-aside'){ state.shelved=state.excerpt; state.excerpt=null; state.scope='open'; render(); toast('Passage set aside — open conversation','dialogue'); return; }
      if (a==='open-chat'){ state.scope='open'; if(state.excerpt){ state.shelved=state.excerpt; state.excerpt=null; } render(); toast('Open conversation with '+hostName(state.host),'dialogue'); return; }
      if (a==='reset-ec'){ state.excerpt=null; state.shelved=null; state.context=[]; render(); toast('Excerpt and context cleared','x'); return; }
      if (a==='starter'){ toast('Starters are inert in this mock','dialogue'); return; }
      if (a==='tools-locked'){ toast('Add an excerpt to use analysis tools','doc'); return; }
      if (a==='ctx-file'){ addCtxDemo('file'); return; }
      if (a==='ctx-text'){ addCtxDemo('text'); return; }
      if (a==='ctx-wizard'){ addCtxDemo('wizard'); return; }
      if (a==='ctx-rm'){ state.context.splice(+act.dataset.i,1); render(); return; }
      if (a==='ctx-open'){ const x=state.context[+act.dataset.i]; if(!x) return; if(x.kind==='file') openEditorTab(x.label); else openCtxText(+act.dataset.i); return; }
      if (a==='tab-go'){ toast(act.dataset.f+' — editor tab is inert in this mock','doc'); return; }
      if (a==='tab-close'){ e.stopPropagation(); state.tabs=state.tabs.filter(f=>f!==act.dataset.f); renderTabs(); return; }
      if (a==='tool' || a==='tools-all') return openTools();
      if (a==='convsettings') return openConvSettings();
      if (a==='widgets') return openWidgets();
      if (a==='todo-tog'){ const t=state.todo[+act.dataset.i]; if(t){ t.done=!t.done; render(); } return; }
      if (a==='send'){ toast('Send is disabled in this mock','send'); return; }
    });
  }
  // context quick-adds (demo)
  function addCtxDemo(kind){
    if (kind==='text') return openCtxText(null);
    if (kind==='file'){ const f={kind:'file',label:'chapter-5.7.md',words:1840}; if(!state.context.some(x=>x.label===f.label)) state.context.push(f); toast('Context added — chapter-5.7.md','doc'); }
    else { const picks=[{kind:'wizard',label:'kayla-voice-guide.md',words:980,text:CTX_WIZ},{kind:'wizard',label:'timeline.md',words:2300,text:'# timeline.md\n\n*Suggested by the context wizard.*\n\n- **Fri, late afternoon** — corridor; Kayla joins the group\n- **Fri, 4:40pm** — auditorium doors\n- **Sat morning** — Nate tells no one'}].filter(p=>!state.context.some(x=>x.label===p.label)); picks.forEach(p=>state.context.push(p)); toast('Context wizard added '+picks.length+' file'+(picks.length===1?'':'s'),'sparkle'); }
    render();
  }

  /* ---------- session hooks (for pm-sessions.js) ---------- */
  function loadSession(sess){
    state.excerpt = sess.excerpt ? {...sess.excerpt} : null;
    state.scope = sess.excerpt ? 'excerpt' : 'open';
    state.shelved = null;
    state.context = (sess.context||[]).map(x=>({...x}));
    state.host = sess.host || 'jill';
    state.mode = sess.mode || 'balanced';
    state.expr = sess.expr || 'amplified';
    state.todo = (sess.todo||[]).map(x=>({...x}));
    state.transcript = (sess.transcript||[]).map(x=>({...x}));
    state.participants = sess.participants ? [...sess.participants] : [sess.host||'jill'];
    state.pins = sess.pins ? {influence:(sess.pins.influence||[]).map(x=>({...x})), decisions:(sess.pins.decisions||[]).map(x=>({...x}))} : {influence:[],decisions:[]};
    state.restored = true;
    state.session = {name: sess.title};
    render();
    toast('Opened — '+sess.title,'cards');
  }
  function newSession(){
    // excerpt + context carry over between sessions — the path chooser offers to continue with them
    if (!state.excerpt && state.shelved) state.excerpt = state.shelved;
    state.shelved = null; state.scope = null;
    state.host='jill'; state.mode='balanced'; state.expr='amplified'; state.depth='reflective';
    state.todo=[]; state.transcript=null; state.participants=null; state.restored=false; state.session=null; state.profileShared=false;
    state.pins={influence:[],decisions:[]};
    render(); toast('New session started','refresh');
  }
  function fullReset(){
    state.excerpt=null; state.shelved=null; state.context=[]; state.scope=null;
    state.host='jill'; state.mode='balanced'; state.expr='amplified'; state.depth='reflective';
    state.todo=[]; state.transcript=null; state.participants=null; state.restored=false; state.session=null; state.profileShared=false;
    state.pins={influence:[],decisions:[]};
    render(); toast('Full reset — session, excerpt and context cleared','refresh');
  }
  function currentSnapshot(){
    return {
      excerpt: state.excerpt, context: state.context, host: state.host,
      mode: state.mode, expr: state.expr, todo: state.todo,
      turns: state.transcript ? state.transcript.length : 0,
      participants: state.participants || [state.host],
      pins: state.pins,
      hostName: hostName(state.host),
    };
  }
  function setSessionName(n){ state.session = n ? {name:n} : state.session; render(); }

  function init(){
    renderTopIcons(); renderTabs(); render(); wire();
  }
  document.addEventListener('DOMContentLoaded', init);

  return { PERSONAS, HOST_ORDER, personIc, hostGlyphs, hostName, fmt, esc, state,
           render, toast, loadSession, newSession, fullReset, currentSnapshot, setSessionName,
           openBrowserFallback: ()=>window.PMSessions&&PMSessions.openBrowser(),
           MODES };
})();
window.PMW = PMW;
