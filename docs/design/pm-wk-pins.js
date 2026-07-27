/* Prose Minion — multi rail (hosts + standing pins) & pinned decisions. Needs icons.js, pm-widgets.js, pm-workshop.js (window.PMW). */
const PMPins = (() => {
  const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const P = () => window.PMW;
  const pIc = (n,o) => { try { return cwIc(n,o); } catch(_) { return (ICONS[n]||ICONS.pin)(o); } };

  function hostsRow(state){
    const parts = state.participants || [state.host];
    const chips = parts.map(id=>`<button class="wk-hostchip${id===state.host?' on':''}" data-pact="host-chip" data-id="${id}" title="${esc(P().PERSONAS[id].spec)} · ${id===state.host?'host':'guest'}"><span class="pav">${P().hostGlyphs(id,15)}</span>${esc(P().hostName(id))}</button>`).join('');
    return `<div class="wk-mrow hosts"><span class="lab">Talking to</span>${chips}<button class="wk-hostchip ghost" data-pact="invite">${P().personIc({size:13,sw:1.8})} Invite guest</button></div>`;
  }
  function pinsRow(state){
    const p = state.pins; if (!p || (!p.influence.length && !p.decisions.length)) return '';
    const chips = p.influence.map((x,i)=>`<span class="wk-pinchip ${x.kind}"><button class="pc-main" data-pact="pin-open" data-i="${i}" title="Re-opens its widget where you left it — standing until unpinned">${pIc(x.icon,{size:12,sw:1.8})}<b>${esc(x.name)}</b><span class="m">${esc(x.meta)}</span></button><button class="pc-x" data-pact="pin-x" data-i="${i}" aria-label="Unpin ${esc(x.name)}">${ICONS.x({size:9,sw:2.6})}</button></span>`).join('');
    const dec = p.decisions.length ? `<div class="wk-decwrap"><button class="wk-pinchip dec" data-pact="dec-fan" aria-expanded="false">${ICONS.stamp({size:12,sw:1.8})}<b>Pinned decisions</b><span class="m">${p.decisions.length}</span><span class="chev">${ICONS.chevDown({size:11})}</span></button><div class="wk-decfan" hidden>${p.decisions.map((d,i)=>`<button class="df-item" data-pact="dec-open" data-i="${i}"><span class="t">${esc(d.title)}</span><span class="m">pinned turn ${d.turn} · ${esc(d.from)}</span></button>`).join('')}<div class="df-foot">Ask ${esc(P().hostName(state.host))} for <b>“all the decisions”</b> — the workup is written from these pins, original and updated text included.</div></div></div>` : '';
    return `<div class="wk-mrow pins"><span class="lab">${ICONS.pin({size:11,sw:2})} Standing</span>${chips}${dec}</div>`;
  }
  function railHTML(state){ return `<div class="wk-mrail">${pinsRow(state)}${hostsRow(state)}</div>`; }

  function openDecision(i){
    const d = P().state.pins.decisions[i]; if (!d) return;
    const root = document.createElement('div'); root.className='cw-panel dc-modal';
    root.appendChild(cwXBtn());
    root.insertAdjacentHTML('beforeend', `
      <div class="cw-eyebrow">Pinned decision <span class="cw-rail standing">standing · rides every turn</span></div>
      <h2>${ICONS.stamp({size:16,sw:1.8})} ${esc(d.title)}</h2>
      <p class="cw-sub">Pinned at turn ${d.turn} · ${esc(d.from)}. The room holds this as settled — it argues <i>from</i> it and never relitigates it.</p>
      <div class="dc-side orig"><span class="cap">original text</span><p>${esc(d.orig)}</p></div>
      <div class="dc-side upd"><span class="cap">updated text</span><p>${esc(d.upd)}</p></div>
      <div class="dc-block"><span class="cap">reasoning</span><p>${esc(d.why)}</p></div>
      <div class="dc-block"><span class="cap">notes · yours</span><p>${d.notes?esc(d.notes):'<span class="none">none added</span>'}</p></div>
      <div class="cw-foot"><span class="cw-fnote">Unpinning is a visible thread event — the room always knows what’s standing.</span><button class="cw-btn ghost" data-pact="dec-unpin" data-i="${i}">Unpin decision</button><button class="cw-btn primary" data-pact="dec-close">Close</button></div>`);
    cwOpen(root);
  }

  document.addEventListener('click', e=>{
    const fan = document.querySelector('.wk-decfan');
    if (fan && !fan.hidden && !e.target.closest('.wk-decwrap')){ fan.hidden = true; const b=document.querySelector('[data-pact="dec-fan"]'); if(b) b.setAttribute('aria-expanded','false'); }
    const act = e.target.closest('[data-pact]');
    if (!act || !P()) return;
    const a = act.dataset.pact, S = P().state;
    if (a==='dec-fan'){ const f=act.parentElement.querySelector('.wk-decfan'); f.hidden=!f.hidden; act.setAttribute('aria-expanded', String(!f.hidden)); return; }
    if (a==='dec-open'){ const f=act.closest('.wk-decfan'); if(f) f.hidden=true; openDecision(+act.dataset.i); return; }
    if (a==='dec-close'){ cwClose(); return; }
    if (a==='dec-unpin'){ const d=S.pins.decisions.splice(+act.dataset.i,1)[0]; cwClose(); P().render(); P().toast('Unpinned — '+(d?d.title:'decision')+' · visible to the room','stamp'); return; }
    if (a==='pin-open'){ const x=S.pins.influence[+act.dataset.i]; if(x) P().toast(x.name+' — re-opens its widget where you left it','sparkle'); return; }
    if (a==='pin-x'){ const x=S.pins.influence.splice(+act.dataset.i,1)[0]; P().render(); P().toast('Unpinned — '+x.name+' · visible to the room','pin'); return; }
    if (a==='invite'){ P().toast('Invite guest — the picker lives in the Invite Guest spread','sparkle'); return; }
    if (a==='host-chip'){ const hb=document.querySelector('[data-act="host"]'); if(hb) hb.click(); return; }
  });

  return { railHTML, openDecision };
})();
window.PMPins = PMPins;
