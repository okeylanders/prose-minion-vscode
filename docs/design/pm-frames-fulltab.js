/* ===== Tools data + picker modal + full-tab Assistant directions ===== */

const TOOLS = [
  { g:'Primary',          n:'Dialogue & Beats', i:'dialogue', d:'Cadence, subtext, and the microbeats between lines.' },
  { g:'Primary',          n:'Prose',            i:'pen',      d:'Line-level rewrite suggestions for flow and clarity.' },
  { g:'Primary',          n:'Gestures',         i:'hand',     d:'Body language — variety, repetition, and intent.' },
  { g:'Craft & Voice',    n:'Cliché',           i:'stamp',    d:'Surface tired phrasings and stock images.' },
  { g:'Craft & Voice',    n:'Repetition',       i:'repeat',   d:'Echoed words, structures, and tics across the passage.' },
  { g:'Craft & Voice',    n:'Decision Points',  i:'branch',   d:'Moments where a character chooses — and the stakes.' },
  { g:'Craft & Voice',    n:'Show & Tell',      i:'eye',      d:'Where you summarize vs. dramatize on the page.' },
  { g:'Craft & Voice',    n:'Choreography',     i:'move',     d:'Spatial logic of movement through a scene.' },
  { g:'Craft & Voice',    n:'Stock & Signature',i:'target',   d:'Generic beats vs. your distinctive authorial moves.' },
  { g:'Craft & Voice',    n:'Placeholders',     i:'search',   d:'Find TODOs, [brackets], and unfinished seams.' },
  { g:'Technical',        n:'Style',            i:'palette',  d:'Weak verbs, adverbs, filler, and passive voice.' },
  { g:'Technical',        n:'Editor',           i:'list',     d:'A holistic developmental editor pass.' },
  { g:'Technical',        n:'Continuity',       i:'link',     d:'Contradictions against characters and prior chapters.' },
  { g:'Technical',        n:'Fresh',            i:'sprout',   d:'Fresh-eyes reactions, as a first-time reader.' },
];

function toolsModal() {
  const groups = ['Primary','Craft & Voice','Technical'];
  return `
  <div class="tm-backdrop">
    <div class="tm">
      <div class="tm-head">
        <div>
          <div class="pm-eyebrow" style="margin:0 0 6px">Prose Excerpt Assistant</div>
          <div style="font-size:20px;font-weight:700">Writing Tools</div>
          <div class="muted" style="font-size:13px;margin-top:4px">Pick an analysis. Each runs on your excerpt with the context brief attached.</div>
        </div>
        <button class="pm-btn ghost" style="padding:8px 10px">${ICONS.x({size:16})}</button>
      </div>
      ${groups.map(g=>`
        <div class="pm-rule-row"><div class="pm-eyebrow">${g}</div><hr></div>
        <div class="tm-grid">
          ${TOOLS.filter(t=>t.g===g).map(t=>`
            <div class="tm-card">
              <div class="tm-ic">${ICONS[t.i]({size:20})}</div>
              <div class="tm-n">${t.n}</div>
              <div class="tm-d">${t.d}</div>
            </div>`).join('')}
        </div>`).join('')}
    </div>
  </div>`;
}

/* ---------- editor chrome ---------- */
function editorChrome(body, opts = {}) {
  return `
  <div class="vscode-tabbar">
    <div class="vs-traffic"><i class="r"></i><i class="y"></i><i class="g"></i></div>
    <div class="vs-tab active"><span class="ic" style="background:#fff">${`<img src="assets/prose-minion-book.png" style="width:13px;height:13px">`}</span> Prose Minion <span class="x">${ICONS.x({size:12})}</span></div>
    <div class="vs-tab">${ICONS.doc({size:13})} chapter-5.8-rewrite.md <span class="x">${ICONS.x({size:12})}</span></div>
  </div>
  <div class="vscode-body">
    <div class="ed-header">
      <div class="pm-brand">
        <div class="pm-logo"><img src="assets/prose-minion-book.png" alt=""></div>
        <div>
          <div class="pm-eyebrow" style="margin:0 0 4px">Prose Minion · Assistant</div>
          <div class="pm-title" style="font-size:23px">Workshop — chapter 5.8</div>
          <div class="pm-subtitle mono" style="font-size:12px">Drafts/workshop/chapter-5.8-rewrite.md · 164 words selected</div>
        </div>
      </div>
      <div class="flex center gap12">
        <div class="pm-select" style="width:auto;background:var(--surface-2);font-size:12.5px;padding:9px 12px">Claude Opus 4.8 <span class="chev" style="margin-left:8px">${ICONS.chevDown({size:13})}</span></div>
        ${BAL}
      </div>
    </div>
    ${body}
  </div>`;
}

/* contextual quick-action bar (changes per analysis type) */
function quickBar(label, actions, primaryIdx = 0) {
  return `
  <div class="qbar">
    <div class="qbar-lab">${ICONS.sparkle({size:13})} Next, for <b>${label}</b></div>
    <div class="qbar-btns">
      ${actions.map((a,i)=>`<button class="qa ${i===primaryIdx?'primary':''}">${a}</button>`).join('')}
    </div>
  </div>`;
}

function avatar() { return `<div class="chat-av"><img src="assets/prose-minion-book.png" style="width:22px;height:22px"></div>`; }

const ANALYSIS_BLOCK = `
  <div class="pm-result" style="margin:0">
    <h3 style="margin-top:0">Dialogue &amp; Microbeat Analysis</h3>
    <h4>${ICONS.dialogue({size:15})} Beat Cadence</h4>
    <p>The clipped "Ya." / "Yep." earns its terseness — but two monosyllables back-to-back flatten the rhythm right before a group exit. Give one speaker a gesture instead of a word.</p>
    <h4>${ICONS.hand({size:15})} Microbeats</h4>
    <p>"shook her head <span class="em">and</span> rendered Raven a wink" stacks two head actions. Pick the one carrying subtext; cut the other.</p>
    <h4>${ICONS.move({size:15})} Choreography</h4>
    <p>"pressed toward the door with Micah at the front" is clear, but "pressed" + "toward" softens the urgency. A harder verb lands the momentum.</p>
  </div>`;

const VARIATIONS = [
  ['Tighter','Ava caught Raven\'s eye and winked. They moved for the door, Micah breaking the lead.'],
  ['With a gesture beat','"Ya." Raven\'s mouth twitched. Ava answered the almost-smile with a wink, and the group spilled toward the door behind Micah.'],
  ['Higher momentum','The wink was the whole goodbye. Then they were moving — Micah first, the rest of them crowding the door.'],
];

function variationCards() {
  return `<div class="var-stack">
    ${VARIATIONS.map((v,i)=>`
      <div class="var-card">
        <div class="var-head"><span class="var-n">Variation ${i+1}</span><span class="pm-pill">${v[0]}</span></div>
        <p class="var-text">${v[1]}</p>
        <div class="var-foot">
          <button class="vf">${ICONS.check({size:13})} Apply to draft</button>
          <button class="vf">${ICONS.copy({size:13})} Copy</button>
          <button class="vf">${ICONS.refresh({size:13})} Redo this one</button>
        </div>
      </div>`).join('')}
  </div>`;
}

/* === Direction A — Conversation thread === */
const DIALOGUE_ACTIONS = ['Generate 3 tighter variations','Add a gesture beat','Show & Tell pass','Flag clichés','Keep as-is'];
function dirThread() {
  const body = `
  <div class="thread-wrap">
    <div class="thread">
      <div class="msg user">
        <div class="bubble">
          <p>Look at the exit beat at the end of the Pentecost scene — does the dialogue land?</p>
          <div class="excerpt-att">
            <div class="ea-head">${ICONS.doc({size:13})} chapter-5.8-rewrite.md · 164 words</div>
            <div class="ea-body mono">"Ya."  "Yep."  Ava shook her head and rendered Raven a wink. The group pressed toward the door with Micah at the front.</div>
          </div>
          <div class="msg-tools"><span class="mt">${ICONS.dialogue({size:12})} Dialogue &amp; Beats</span></div>
        </div>
      </div>

      <div class="msg bot">
        ${avatar()}
        <div class="bubble">${ANALYSIS_BLOCK}</div>
      </div>

      <div class="msg user"><div class="bubble"><p>Do the tighter variations.</p></div></div>

      <div class="msg bot">
        ${avatar()}
        <div class="bubble">
          <p style="margin:0 0 12px">Three passes, each keeping the wink as the goodbye:</p>
          ${variationCards()}
        </div>
      </div>
    </div>

    <div class="composer-wrap">
      ${quickBar('Dialogue &amp; Beats', DIALOGUE_ACTIONS)}
      <div class="composer">
        <button class="comp-add">${ICONS.plus({size:18})}</button>
        <div class="comp-input pm-placeholder">Ask for a change, or pick a tool…</div>
        <div class="comp-right">
          <span class="comp-pill">${ICONS.grid({size:13})} Tools</span>
          <button class="comp-send">${ICONS.send({size:16})}</button>
        </div>
      </div>
    </div>
  </div>`;
  return editorChrome(body);
}

/* === Direction B — Split: pinned excerpt + conversation === */
function dirSplit() {
  const body = `
  <div class="split">
    <aside class="split-left">
      <div class="sl-block">
        <div class="flex between center"><div class="pm-eyebrow" style="margin:0">${ICONS.pin({size:12})} Working Excerpt</div><span class="pm-pill">Pinned</span></div>
        <div class="sl-excerpt mono">"Ya."

"Yep."

Ava shook her head and rendered Raven a wink. The group pressed toward the door with Micah at the front.</div>
      </div>
      <div class="sl-block">
        <div class="pm-eyebrow">Context Brief</div>
        <p class="muted" style="font-size:12.5px;margin:0 0 9px">YA Contemporary · Christian mysticism · grief narrative</p>
        <div class="pm-chips">${['Micah/voice-guide.md','Ava/character.md','chapter-5.7.md','CLAUDE.md'].map(c=>`<span class="pm-chip">${c}</span>`).join('')}</div>
      </div>
      <div class="sl-block grow">
        <div class="pm-eyebrow">Tools</div>
        <div class="sl-tools">
          ${TOOLS.slice(0,6).map((t,i)=>`<button class="slt ${i===0?'active':''}">${ICONS[t.i]({size:15})} ${t.n}</button>`).join('')}
          <button class="slt ghost">${ICONS.grid({size:15})} All 14 tools…</button>
        </div>
      </div>
    </aside>

    <section class="split-right">
      <div class="thread compact">
        <div class="msg bot">${avatar()}<div class="bubble">${ANALYSIS_BLOCK}</div></div>
        <div class="msg user"><div class="bubble"><p>Add a gesture beat instead of the second line.</p></div></div>
        <div class="msg bot">${avatar()}<div class="bubble"><p style="margin:0 0 10px">Swapping "Yep." for a beat that carries the same agreement:</p>
          <div class="var-card"><p class="var-text">"Ya." Raven's mouth twitched — agreement enough. Ava answered it with a wink, and the group spilled toward the door behind Micah.</p>
          <div class="var-foot"><button class="vf">${ICONS.check({size:13})} Apply</button><button class="vf">${ICONS.copy({size:13})} Copy</button><button class="vf">${ICONS.branch({size:13})} Branch</button></div></div>
        </div></div>
      </div>
      <div class="composer-wrap">
        ${quickBar('Gestures', ['Vary the gesture','Make it subtler','Tie to Raven\'s voice guide','Show & Tell pass','Keep as-is'])}
        <div class="composer">
          <button class="comp-add">${ICONS.plus({size:18})}</button>
          <div class="comp-input pm-placeholder">Ask a follow-up…</div>
          <div class="comp-right"><button class="comp-send">${ICONS.send({size:16})}</button></div>
        </div>
      </div>
    </section>
  </div>`;
  return editorChrome(body);
}

/* === Direction C — Branch board === */
function dirBoard() {
  const body = `
  <div class="board">
    <div class="board-top">
      <div class="pm-eyebrow" style="margin:0">${ICONS.branch({size:13})} Branch board</div>
      <div class="muted" style="font-size:12.5px">Every analysis and rewrite is a card. Branch any card to explore in parallel — nothing overwrites your draft until you apply it.</div>
    </div>

    <div class="spine">
      <div class="node">
        <div class="node-dot">${ICONS.doc({size:13})}</div>
        <div class="bcard origin">
          <div class="bcard-h"><span class="bk">Excerpt</span><span class="muted mono" style="font-size:11px">164 words</span></div>
          <p class="mono bcard-x">"Ya." "Yep." Ava shook her head and rendered Raven a wink. The group pressed toward the door…</p>
        </div>
      </div>

      <div class="node">
        <div class="node-dot accent-dot">${ICONS.dialogue({size:13})}</div>
        <div class="bcard">
          <div class="bcard-h"><span class="bk accent">Dialogue &amp; Beats</span><span class="pm-pill">done</span></div>
          <p class="bcard-p">Two monosyllables flatten the rhythm before the exit. Give one speaker a gesture, not a word.</p>
          <div class="bcard-foot">
            <button class="bf primary">${ICONS.sparkle({size:12})} Generate variations</button>
            <button class="bf">${ICONS.branch({size:12})} Branch</button>
            <button class="bf">${ICONS.refresh({size:12})} Redo</button>
          </div>
        </div>
      </div>

      <div class="branch-group">
        <div class="branch-label">${ICONS.sparkle({size:12})} 3 variations · branched from Dialogue &amp; Beats</div>
        <div class="branch-cards">
          ${VARIATIONS.map((v,i)=>`
            <div class="bcard var">
              <div class="bcard-h"><span class="bk">Var ${i+1}</span><span class="pm-pill">${v[0]}</span></div>
              <p class="var-text">${v[1]}</p>
              <div class="bcard-foot"><button class="bf">${ICONS.check({size:12})} Apply</button><button class="bf">${ICONS.branch({size:12})} Branch</button></div>
            </div>`).join('')}
          <div class="bcard add">${ICONS.plus({size:18})}<span>More variations</span></div>
        </div>
      </div>

      <div class="node ghost-node">
        <div class="node-dot">${ICONS.plus({size:13})}</div>
        <div class="bcard add wide"><span class="muted">Run another tool on the excerpt…</span>
          <div class="flex gap8" style="margin-top:10px">${['Gestures','Choreography','Show & Tell','Cliché'].map(t=>`<span class="pm-chip">${t}</span>`).join('')}</div>
        </div>
      </div>
    </div>

    <div class="cmdbar">
      <button class="comp-add">${ICONS.plus({size:18})}</button>
      <div class="comp-input pm-placeholder">Ask, or run a tool to spawn a card…</div>
      <div class="comp-right"><span class="comp-pill">${ICONS.grid({size:13})} Tools</span><button class="comp-send">${ICONS.send({size:16})}</button></div>
    </div>
  </div>`;
  return editorChrome(body);
}
