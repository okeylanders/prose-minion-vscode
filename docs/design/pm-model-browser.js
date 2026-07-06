/* ===== Prose Minion — Model Browser: data + render + interactivity ===== */

/* Provider catalog counts (live from OpenRouter). The list below renders a
   representative card per provider; counts reflect the full catalog. */
const MB_PROVIDERS = [
  { name: 'All',      count: 82 },
  { name: 'OpenAI',   count: 18 },
  { name: 'Anthropic',count: 11 },
  { name: 'Qwen',     count: 8 },
  { name: 'Z.AI',     count: 7 },
  { name: 'Google',   count: 7 },
  { name: 'DeepSeek', count: 6 },
  { name: 'Moonshot', count: 4 },
  { name: 'Mistral',  count: 4 },
];

const MB_MODELS = [
  { provider:'Anthropic', name:'Claude Opus 4.8', family:'Claude Opus', date:'2026-05', ctx:'1M',
    in:'$5', out:'$25', selected:true,
    desc:"Anthropic's newest Opus. 1M context, improved agentic reasoning, premium long-form prose analysis for difficult scenes and manuscript-scale critique." },
  { provider:'Anthropic', name:'Claude Sonnet 4.6', family:'Claude Sonnet', date:'2026-02', ctx:'1M',
    in:'$3', out:'$15',
    desc:'Most capable Sonnet generation with improved reasoning consistency and 1M-context readiness for long workflows.' },
  { provider:'OpenAI', name:'GPT-5.2', family:'GPT-5.2', date:'2025-12', ctx:'400K',
    in:'$1.75', out:'$14',
    desc:'Frontier-grade model with adaptive reasoning that allocates more depth to complex tasks. Great for creative writing.' },
  { provider:'Google', name:'Gemini 3.1 Pro Preview', family:'Gemini 3.1', date:'2026-02', ctx:'1M',
    in:'$2', out:'$12',
    desc:'A master of scale and style. Weaves complex plot threads into cohesive prose over massive contexts.' },
  { provider:'Z.AI', name:'GLM 5.2', family:'GLM 5', date:'2026-06', ctx:'1M',
    in:'$0.95', out:'$3',
    desc:"Z.AI's latest flagship. Stronger long-horizon reasoning for manuscript-scale critique and reliable multi-step prose generation." },
  { provider:'Qwen', name:'Qwen3.7 Plus', family:'Qwen3.7', date:'2026-06', ctx:'1M',
    in:'$0.32', out:'$1.28',
    desc:'Cost-effective Qwen3.7 sibling with 1M context. Strong value for long-context prose analysis and structured edits.' },
  { provider:'DeepSeek', name:'DeepSeek V4 Flash', family:'DeepSeek V4', date:'2026-04', ctx:'1M',
    in:'$0.09', out:'$0.18',
    desc:'Efficiency-focused 1M-context model. Good for fast dictionary work, rewrites, and budget long-context analysis.' },
  { provider:'Moonshot', name:'Kimi K2.5', family:'Kimi K2', date:'2026-05', ctx:'256K',
    unavailable:true,
    desc:"Moonshot's long-context generalist. Pricing is temporarily unavailable — showing cached metadata while OpenRouter rates reconnect." },
];

const mbState = { mode: 'provider', filter: 'All', q: '', selected: 'Claude Opus 4.8' };

/* build the chip set for the active pivot */
function mbChips() {
  if (mbState.mode === 'provider') return MB_PROVIDERS;
  // By Family — derive from the rendered models
  const fams = [];
  const seen = {};
  MB_MODELS.forEach(m => { if (!seen[m.family]) { seen[m.family] = true; fams.push({ name: m.family, count: 1 }); } });
  return [{ name: 'All', count: MB_MODELS.length }, ...fams];
}

function mbDimension(m) { return mbState.mode === 'provider' ? m.provider : m.family; }

function mbPrice(m) {
  if (m.unavailable) {
    return `<div class="mb-price unavail"><div class="mb-price-val">— / —</div><div class="mb-price-cap">Pricing N/A</div></div>`;
  }
  return `<div class="mb-price"><div class="mb-price-val">${m.in} <span style="color:var(--faint)">/</span> <span class="out">${m.out}</span></div><div class="mb-price-cap">per 1M</div></div>`;
}

function mbCard(m) {
  const sel = m.name === mbState.selected;
  return `
    <div class="mb-card${sel ? ' selected' : ''}" data-model="${m.name}">
      ${sel ? `<div class="mb-check">${ICONS.check({ size: 13, sw: 3 })}</div>` : ''}
      <div class="mb-card-top">
        <div class="mb-name">${m.name}</div>
        ${mbPrice(m)}
      </div>
      <div class="mb-badges">
        <span class="mb-badge fam">${m.family}</span>
        <span class="mb-badge">${m.date}</span>
        <span class="mb-badge ctx">${m.ctx} ctx</span>
      </div>
      <p class="mb-desc">${m.desc}</p>
    </div>`;
}

function mbRenderList() {
  const q = mbState.q.trim().toLowerCase();
  let rows = MB_MODELS.filter(m => {
    const passFilter = mbState.filter === 'All' || mbDimension(m) === mbState.filter;
    const hay = (m.name + ' ' + m.provider + ' ' + m.family + ' ' + m.desc).toLowerCase();
    const passQ = !q || hay.includes(q);
    return passFilter && passQ;
  });

  if (!rows.length) {
    return `<div class="mb-empty">No models match “${mbState.q}”.</div>`;
  }

  // group by active dimension, preserving first-seen order
  const order = [];
  const groups = {};
  rows.forEach(m => {
    const k = mbDimension(m);
    if (!groups[k]) { groups[k] = []; order.push(k); }
    groups[k].push(m);
  });

  return order.map(k => `
    <div class="mb-group-rule"><div class="pm-eyebrow">${k}</div><span class="ct">${groups[k].length}</span><hr></div>
    <div class="mb-list">${groups[k].map(mbCard).join('')}</div>
  `).join('');
}

function mbRenderChips() {
  return mbChips().map(c => `
    <button class="mb-fchip${c.name === mbState.filter ? ' active' : ''}" data-chip="${c.name}">
      ${c.name} <span class="ct">${c.count}</span>
    </button>`).join('');
}

function modelBrowser() {
  return `
  <div class="mb-panel">
    <div class="mb-head">
      <div>
        <div class="pm-eyebrow">Prose Excerpt Assistant</div>
        <div class="mb-head-title">Choose a Model</div>
        <div class="mb-head-sub">Pick the model for prose analysis. Pricing and context are live from OpenRouter.</div>
      </div>
      <button class="mb-x" title="Close">${ICONS.x({ size: 16 })}</button>
    </div>

    <div class="mb-controls">
      <div class="mb-search">
        ${ICONS.search({ size: 15 })}
        <input id="mb-q" type="text" placeholder="Search models, providers, families…" autocomplete="off">
      </div>
      <div class="pm-seg mb-pivots" id="mb-pivots">
        <button class="${mbState.mode === 'provider' ? 'active' : ''}" data-mode="provider">By Provider</button>
        <button class="${mbState.mode === 'family' ? 'active' : ''}" data-mode="family">By Family</button>
      </div>
      <div class="mb-chiprow" id="mb-chips">${mbRenderChips()}</div>
    </div>

    <div class="mb-body" id="mb-body">${mbRenderList()}</div>

    <div class="mb-foot"><span class="pm-dot"></span> <span><b>OpenRouter</b> · 82 models · prices per 1M tokens (input / output)</span></div>
  </div>`;
}

/* ---- wire up interactivity within a given root element ---- */
function mountModelBrowser(rootId) {
  const root = document.getElementById(rootId);
  if (!root) return;
  root.innerHTML = modelBrowser();

  const rerenderChips = () => { root.querySelector('#mb-chips').innerHTML = mbRenderChips(); };
  const rerenderList  = () => { root.querySelector('#mb-body').innerHTML = mbRenderList(); };

  // pivot toggle
  root.querySelector('#mb-pivots').addEventListener('click', e => {
    const btn = e.target.closest('button[data-mode]');
    if (!btn) return;
    mbState.mode = btn.dataset.mode;
    mbState.filter = 'All';
    root.querySelectorAll('#mb-pivots button').forEach(b => b.classList.toggle('active', b === btn));
    rerenderChips();
    rerenderList();
  });

  // chip filter (delegated — chips re-render)
  root.querySelector('#mb-chips').addEventListener('click', e => {
    const btn = e.target.closest('button[data-chip]');
    if (!btn) return;
    mbState.filter = btn.dataset.chip;
    rerenderChips();
    rerenderList();
  });

  // card select (delegated — list re-renders)
  root.querySelector('#mb-body').addEventListener('click', e => {
    const card = e.target.closest('.mb-card[data-model]');
    if (!card) return;
    mbState.selected = card.dataset.model;
    rerenderList();
  });

  // search
  root.querySelector('#mb-q').addEventListener('input', e => {
    mbState.q = e.target.value;
    rerenderList();
  });
}
