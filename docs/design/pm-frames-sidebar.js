/* ===== Shared chrome + sidebar tab bodies ===== */

const BAL = `
<div class="pm-balance">
  <div class="pm-balance-rows">
    <div class="pm-balance-row">
      <span class="pm-dot blue"></span>
      <span class="pm-balance-label">OpenRouter</span>
      <span class="pm-balance-val">$12.40</span>
    </div>
    <div class="pm-balance-sub">Last request&nbsp; <b>$0.014</b></div>
  </div>
  <span class="pm-chev">${ICONS.chevDown({size:14})}</span>
</div>`;

const TABS = [
  { id: 'assistant', label: 'Assistant', icon: 'bot' },
  { id: 'search',    label: 'Search',    icon: 'search' },
  { id: 'metrics',   label: 'Metrics',   icon: 'bars' },
  { id: 'dictionary',label: 'Dictionary',icon: 'book' },
];

function tabBar(active) {
  return `<div class="pm-tabs">${TABS.map(t => `
    <div class="pm-tab ${t.id===active?'active':''}">${ICONS[t.icon]({size:21})}<span>${t.label}</span></div>`).join('')}</div>`;
}

function sidebarChrome(active, body) {
  return `
  <div class="pm">
    <div class="pm-strip">
      <span class="pm-strip-title">Prose Minion: Writing Tools</span>
      <span class="pm-strip-icons">${ICONS.gear({size:16})}</span>
    </div>
    <div class="pm-header">
      <div class="pm-brand">
        <div class="pm-logo"><img src="assets/prose-minion-book.png" alt=""></div>
        <div>
          <div class="pm-title">Prose Minion</div>
          <div class="pm-subtitle">AI-powered writing assistance</div>
        </div>
      </div>
      ${BAL}
    </div>
    ${tabBar(active)}
    <div class="pm-body">${body}</div>
  </div>`;
}

/* ---------- Assistant body (sidebar) ---------- */
function bodyAssistant() {
  return `
  <label class="pm-field-label">Assistant Model</label>
  <div class="pm-select" style="margin-bottom:16px">Claude Opus 4.8 <span class="chev">${ICONS.chevDown({size:14})}</span></div>
  <div class="pm-section-title">Prose Excerpt Assistant</div>

  <div class="pm-card">
    <div class="pm-card-head">
      <span class="pm-card-label">Excerpt for Assistance &amp; Analysis</span>
      <span class="pm-sq">${ICONS.clipboard({size:16})}</span>
    </div>
    <div class="pm-card-meta">Source: Drafts/workshop/chapter-5.8-rewrite.md</div>
    <div class="pm-textarea">"Ya."

"Yep."

Ava shook her head and rendered Raven a wink. The group pressed toward the door with Micah at the front.</div>
    <div class="pm-wordcount">164 / 2000 words</div>
  </div>

  <div class="pm-card">
    <div class="pm-card-head">
      <span class="pm-card-label">Context Brief <span class="dim" style="font-weight:400">(optional)</span></span>
      <span class="pm-sq plain">${ICONS.bot({size:16})}</span>
    </div>
    <div class="pm-textarea" style="min-height:46px">## Genre
— Primary: YA Contemporary Fiction with Christian Mysticism…</div>
    <div class="flex between center" style="margin-top:9px">
      <span class="pm-wordcount" style="color:var(--amber)">1,425 words</span>
      <span class="pm-card-meta" style="margin:0">Context Model: claude-sonnet-4.6</span>
    </div>
    <div class="pm-eyebrow" style="margin:12px 0 7px">Resources referenced</div>
    <div class="pm-chips">
      ${['AGENTS.md','CLAUDE.md','readme.md','chapter-5.7.md','chapter-5.8.md','Micah/character.md','Micah/voice-guide.md','Ava/character.md','Jasper/voice-guide.md'].map(c=>`<span class="pm-chip">${c}</span>`).join('')}
    </div>
  </div>

  <div class="pm-card" style="background:var(--surface-2)">
    <div class="flex between center" style="margin-bottom:12px">
      <span class="pm-card-label">Analyze &amp; Suggest Improvements</span>
      <button class="pm-btn ghost" style="padding:6px 11px;font-size:12px">${ICONS.grid({size:14})} All tools</button>
    </div>
    <div class="flex gap8" style="margin-bottom:10px">
      <button class="pm-btn primary grow">${ICONS.dialogue({size:15})} Dialogue &amp; Beats</button>
      <button class="pm-btn grow">${ICONS.pen({size:15})} Prose</button>
      <button class="pm-btn grow">${ICONS.hand({size:15})} Gestures</button>
    </div>
    <div class="pm-eyebrow" style="margin:12px 0 7px">Craft &amp; Voice</div>
    <div class="pm-chips">
      ${['Cliché','Repetition','Decision Points','Show &amp; Tell','Choreography','Stock &amp; Signature','Placeholders'].map(c=>`<span class="pm-chip" style="padding:7px 11px">${c}</span>`).join('')}
    </div>
  </div>

  <div class="pm-result">
    <div class="res-actions"><span class="pm-sq plain">${ICONS.clipboard({size:14})}</span><span class="pm-sq plain">${ICONS.save({size:14})}</span></div>
    <h3>Pentecost — Dialogue &amp; Microbeat Analysis</h3>
    <p class="em">Note on the missing file: Your context flags chapter-5.8-rewrite.md as standalone. Treating this excerpt as a transitional beat — decompression between two set-pieces.</p>
    <h4>${ICONS.dialogue({size:15})} Beat Cadence</h4>
    <p>The clipped "Ya." / "Yep." exchange earns its terseness, but two monosyllables back-to-back flattens the rhythm. Consider giving one speaker a gesture instead of a word.</p>
    <h4>${ICONS.hand({size:15})} Microbeats</h4>
    <p>"shook her head and rendered Raven a wink" stacks two head actions — pick the one that carries subtext.</p>
  </div>`;
}

/* ---------- Search body (sidebar) ---------- */
function bodyScope() {
  return `
  <div class="pm-card">
    <div class="pm-card-label" style="margin-bottom:10px">Scope</div>
    <div class="pm-seg" style="margin-bottom:12px">
      <button>Active File</button><button class="active">Manuscripts</button><button>Chapters</button><button>Selection</button>
    </div>
    <label class="pm-field-label">Path / Pattern</label>
    <div class="pm-input mono">Manuscripts/*.md</div>
  </div>`;
}
function bodySearch() {
  return `
  <div class="pm-seg" style="margin-bottom:14px">
    <button class="active">Word Search</button><button>Category Search</button>
  </div>
  ${bodyScope()}
  <div class="pm-card">
    <div class="pm-card-head">
      <span class="pm-card-label">Targets <span class="dim" style="font-weight:400;font-size:11px">one per line or comma-separated</span></span>
      <span class="pm-sq plain">${ICONS.bot({size:16})}</span>
    </div>
    <div class="pm-textarea" style="min-height:56px">hair, blond</div>
    <div class="flex gap8" style="margin-top:12px">
      <div class="grow"><label class="pm-field-label">Context words</label><div class="pm-input mono">3</div></div>
      <div class="grow"><label class="pm-field-label">Cluster window</label><div class="pm-input mono">10</div></div>
      <div class="grow"><label class="pm-field-label">Min cluster</label><div class="pm-input mono">10</div></div>
    </div>
    <button class="pm-btn primary block" style="margin-top:14px">${ICONS.bolt({size:15})} Run Search</button>
  </div>

  <div class="pm-result">
    <div class="res-actions"><span class="pm-sq plain">${ICONS.clipboard({size:14})}</span><span class="pm-sq plain">${ICONS.save({size:14})}</span></div>
    <h4>${ICONS.search({size:15})} Word Search</h4>
    <p class="kv"><b>Targets:</b> <span class="tok-chip">blond</span>, <span class="tok-chip">hair</span></p>
    <p class="kv"><b>Total occurrences:</b> 21 across 15 files · <b>Avg gap:</b> 230.2 words</p>
    <table class="pm-table" style="margin-top:10px">
      <thead><tr><th>File</th><th>Word</th><th class="r">Hits</th></tr></thead>
      <tbody>
        ${[['chapter-1.2.md','hair','2'],['chapter-2.3.md','hair','3'],['chapter-4.1.md','hair','2'],['chapter-1.5.md','blond','1']].map(r=>`<tr><td>${r[0]}</td><td><span class="tok">${r[1]}</span></td><td class="r">${r[2]}</td></tr>`).join('')}
      </tbody>
    </table>
  </div>`;
}

/* ---------- Metrics body (sidebar) ---------- */
function bodyMetrics() {
  const overview = [['📝 Total Words','40,312'],['🎯 Unique Words','6,082'],['🌈 Vocabulary Diversity','15.1%'],['🎨 Lexical Density','69.2%'],['📖 Readability Score','83.9'],['🚩 Readability Grade','5.4']];
  const bars = [['3 chars','19.4%',64],['4 chars','18.2%',60],['5 chars','13.5%',45],['6 chars','11.1%',37],['7 chars','9.1%',30]];
  return `
  <div class="pm-seg" style="margin-bottom:14px">
    <button class="active">Prose Statistics</button><button>Style Flags</button><button>Word Frequency</button>
  </div>
  ${bodyScope()}
  <div class="pm-card">
    <div class="flex gap8">
      <div class="grow"><label class="pm-field-label">Publishing Standard</label><div class="pm-select mono" style="font-size:12px">Young Adult (YA) <span class="chev">${ICONS.chevDown({size:13})}</span></div></div>
      <div class="grow"><label class="pm-field-label">Trim Size</label><div class="pm-select mono" style="font-size:12px">5.5 × 8.5 in <span class="chev">${ICONS.chevDown({size:13})}</span></div></div>
    </div>
    <button class="pm-btn primary block" style="margin-top:14px">${ICONS.gear({size:15})} Generate Prose Statistics</button>
  </div>

  <div class="pm-result">
    <div class="res-actions"><span class="pm-sq plain">${ICONS.clipboard({size:14})}</span><span class="pm-sq plain">${ICONS.save({size:14})}</span></div>
    <h4>${ICONS.bars({size:15})} Prose Statistics</h4>
    <table class="pm-table" style="margin:6px 0 16px">
      <thead><tr><th>Metric</th><th class="r">Value</th></tr></thead>
      <tbody>${overview.map(r=>`<tr><td>${r[0]}</td><td class="r"><span class="tok">${r[1]}</span></td></tr>`).join('')}</tbody>
    </table>
    <div class="pm-eyebrow" style="margin-bottom:10px">📏 Word Length Distribution</div>
    ${bars.map(b=>`<div class="pm-bar-row"><span class="lab">${b[0]}</span><div class="pm-bar-track"><div class="pm-bar-fill" style="width:${b[2]}%"></div></div><span class="pct">${b[1]}</span></div>`).join('')}
  </div>`;
}

/* ---------- Dictionary body (sidebar) ---------- */
function bodyDictionary() {
  return `
  <label class="pm-field-label">Dictionary Model</label>
  <div class="pm-select" style="margin-bottom:16px">Gemini 3.5 Flash <span class="chev">${ICONS.chevDown({size:14})}</span></div>
  <div class="pm-eyebrow">Utilities · Dictionary</div>

  <div class="pm-card">
    <div class="pm-card-head">
      <span class="pm-card-label">Target Word or Phrase <span class="dim" style="font-weight:400;font-size:11px">6 words max</span></span>
      <span class="pm-sq">${ICONS.clipboard({size:16})}</span>
    </div>
    <div class="pm-card-meta">Source: Drafts/chapter-1.5.md</div>
    <div class="pm-input mono">glanced</div>
  </div>
  <div class="pm-card">
    <div class="pm-card-head">
      <span class="pm-card-label">Optional Context</span>
      <span class="pm-sq">${ICONS.clipboard({size:16})}</span>
    </div>
    <div class="pm-textarea pm-placeholder">Paste a sentence, paragraph, or notes to guide the dictionary output…</div>
    <div class="pm-wordcount">0 / 500 words</div>
  </div>
  <div class="flex gap8" style="margin-bottom:14px">
    <button class="pm-btn grow">Run Dictionary Lookup</button>
    <button class="pm-btn primary grow">${ICONS.bolt({size:15})} Fast Lookup</button>
  </div>

  <div class="pm-result">
    <div class="res-actions"><span class="pm-sq plain">${ICONS.clipboard({size:14})}</span><span class="pm-sq plain">${ICONS.save({size:14})}</span></div>
    <h3>Word: glanced</h3>
    <h4>${ICONS.book({size:15})} Definition</h4>
    <p>To direct the gaze briefly and quickly; to strike a surface at an oblique angle and deflect.</p>
    <h4>${ICONS.wave({size:15})} Pronunciation</h4>
    <p class="kv"><b>IPA:</b> /glɑːnst/ &nbsp; <span class="em">GLANST · GLAHNST</span></p>
    <h4>${ICONS.search({size:15})} Sense Explorer</h4>
    <p class="kv"><b>The Fleeting Look</b> — a quick, momentary look, often covertly.</p>
    <p class="em">Synonyms: peeked, glimpsed, flicked, scanned, darted</p>
  </div>`;
}
