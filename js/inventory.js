/**
 * inventory.js — Inventário v3
 * CRUD categorizado, upload Base64, bolsa de moedas, equipar item, limite de carga
 */

import { CharacterState, Toast } from './app.js';

const CATS      = ['Equipamentos','Armas','Poções','Acessórios','Utilizáveis'];
const CAT_ICONS = { 'Equipamentos':'🛡','Armas':'⚔','Poções':'⚗','Acessórios':'💍','Utilizáveis':'✨' };
const TYPES     = {
  'Equipamentos': ['Armadura','Escudo','Capacete','Botas','Luvas','Capa','Outros'],
  'Armas':        ['Espada','Machado','Arco','Cajado','Adaga','Lança','Maça','Outros'],
  'Poções':       ['Cura','Veneno','Buff','Mana','Resistência','Outros'],
  'Acessórios':   ['Anel','Amuleto','Bracelete','Cinto','Outros'],
  'Utilizáveis':  ['Pergaminho','Runa','Bomba','Ferramenta','Outros']
};
const COIN_NAMES = { pp:'Platina', po:'Ouro', pe:'Electrum', pa:'Prata', pc:'Cobre' };
const COIN_ICONS = { pp:'⬜', po:'💰', pe:'🟩', pa:'🪙', pc:'🟤' };
const COIN_KEYS  = ['pp','po','pe','pa','pc'];
const DMG_TYPES  = ['Cortante','Perfurante','Contundente','Fogo','Gelo','Raio',
                    'Necrótico','Psíquico','Radiante','Ácido','Veneno','Trovão','Força'];
const STATUSES   = ['Normal','Equipado','Maldito','Danificado','Lendário'];

export const InventoryModule = (() => {
  let _panelEl        = null;
  let _activeCat      = 'Equipamentos';
  let _activeSlot     = null;
  let _pendingImgAdd  = null;
  let _pendingImgEdit = null;

  const init = (panelEl) => { _panelEl = panelEl; render(); };

  const render = () => {
    _panelEl.innerHTML =
      _htmlCarryBar() + _htmlCoins() + _htmlCatTabs() + _htmlGrid() +
      _htmlViewModal() + _htmlAddModal() + _htmlEditModal();
    _attachAll();
    refreshItemIcons();
  };

  // ── Carry Bar ─────────────────────────────────────────────────────────────
  const _htmlCarryBar = () => {
    const total  = CharacterState.getTotalWeight();
    const limit  = CharacterState.getCarryLimit();
    const pct    = Math.min(100, (total / (limit||1)) * 100);
    const over   = total > limit;
    const color  = over ? 'var(--crimson-bright)' : pct > 75 ? '#e09320' : 'var(--arcane-bright)';
    return `
      <div class="card mb-2">
        <div class="card-title" style="display:flex;justify-content:space-between">
          <span>Capacidade de Carga</span>
          <span style="font-size:0.82rem;color:${over?'var(--crimson-bright)':'var(--text-muted)'}">
            ${over?'⚠️ ':''}${total.toFixed(2)} / ${limit.toFixed(1)} kg
          </span>
        </div>
        <div style="height:8px;background:var(--bg-input);border-radius:4px;overflow:hidden">
          <div style="height:100%;width:${pct}%;background:${color};transition:width 0.3s;border-radius:4px"></div>
        </div>
        <div style="font-size:0.75rem;color:var(--text-dim);margin-top:0.3rem">
          FOR ${CharacterState.getTotalAttr('str')} × 7,5 kg = ${limit.toFixed(1)} kg limite
        </div>
      </div>`;
  };

  // ── Coins ─────────────────────────────────────────────────────────────────
  const _htmlCoins = () => {
    const c = CharacterState.get().coins || {};
    const cards = COIN_KEYS.map(k => `
      <div class="coin-card coin-${k}">
        <span class="coin-icon">${COIN_ICONS[k]}</span>
        <span class="coin-name">${k.toUpperCase()}</span>
        <span class="coin-val" id="cv-${k}">${c[k]||0}</span>
        <div class="coin-acts">
          <button class="cbtn" data-coin="${k}" data-delta="-1">−</button>
          <button class="cbtn" data-coin="${k}" data-delta="1">+</button>
        </div>
      </div>`).join('');
    const selOpts = COIN_KEYS.map(k =>
      `<option value="${k}" ${k==='po'?'selected':''}>${k.toUpperCase()} — ${COIN_NAMES[k]}</option>`
    ).join('');
    return `
      <div class="coins-panel">
        <p class="coins-title">💰 Bolsa de Moedas</p>
        <div class="coins-grid">${cards}</div>
        <div class="coins-qrow">
          <label>Transação:</label>
          <input type="number" class="cqinput" id="coin-amt" placeholder="qtd" min="0">
          <select class="cqsel" id="coin-sel">${selOpts}</select>
          <button class="qbtn qbtn-add" id="qbtn-add">+ Receber</button>
          <button class="qbtn qbtn-sub" id="qbtn-sub">− Gastar</button>
        </div>
        <p class="po-equiv" id="po-equiv">Equivalente total: <b>${CharacterState.getTotalPO().toFixed(2)} PO</b></p>
      </div>`;
  };

  // ── Category tabs ─────────────────────────────────────────────────────────
  const _htmlCatTabs = () => {
    const btns = CATS.map(c =>
      `<button class="cat-btn ${c===_activeCat?'active':''}" data-cat="${c}">${CAT_ICONS[c]} ${c}</button>`
    ).join('');
    return `
      <div class="cat-tabs">${btns}</div>
      <div class="slots-bar">
        <span class="cat-label" id="cat-label-txt">${CAT_ICONS[_activeCat]} ${_activeCat.toUpperCase()}</span>
        <span class="slots-count"><b id="used-slots">${CharacterState.getItemsByCategory(_activeCat).length}</b> / ${CharacterState.SLOTS_MAX} slots</span>
      </div>
      <div style="display:flex;justify-content:flex-end;margin-bottom:.5rem">
        <button class="btn btn-primary btn-sm" id="btn-open-add">+ Adicionar Item</button>
      </div>`;
  };

  // ── Grid ──────────────────────────────────────────────────────────────────
  const _htmlGrid = () => {
    const items = CharacterState.getItemsByCategory(_activeCat);
    let slots = '';
    for (let i = 0; i < CharacterState.SLOTS_MAX; i++) {
      const item = items[i];
      if (item) {
        const isEquipped = item.status === 'Equipado';
        const img = item.img
       ? `<img class="item-icon" data-image-id="${item.img}" alt="${_esc(item.name)}" style="width:100%; height:100%; object-fit:cover; border-radius:4px;">`
        : `<span class="eico">${CAT_ICONS[_activeCat]}</span>`;
        const badge  = item.qty > 1 ? `<span class="qty-badge">×${item.qty}</span>` : '';
        const eqMark = isEquipped ? `<span style="position:absolute;top:3px;right:3px;font-size:0.65rem;color:var(--gold)">⚙</span>` : '';
        slots += `
          <div class="slot filled ${isEquipped?'slot-equipped':''}" data-slot="${i}" data-cat="${_activeCat}"
               title="${_esc(item.name)}${isEquipped?' [Equipado]':''}">
            ${img}${badge}${eqMark}
            <span class="snum">${i+1}</span>
          </div>`;
      } else {
        slots += `<div class="slot" data-slot="${i}" data-cat="${_activeCat}"><span class="snum">${i+1}</span></div>`;
      }
    }
    return `<div class="inventory-grid" id="inv-grid">${slots}</div>`;
  };

  // ── View Modal ────────────────────────────────────────────────────────────
  const _htmlViewModal = () => `
    <div class="modal-overlay" id="inv-view-modal">
      <div class="modal-box" style="max-width:480px">
        <div class="inv-view-header">
          <div class="inv-modal-img" id="vm-img">🎒</div>
          <div style="flex:1">
            <div class="modal-title" id="vm-name" style="font-size:1rem;font-family:var(--font-heading);color:var(--gold)">—</div>
            <div class="mtype" id="vm-type">—</div>
            <div class="mcat"  id="vm-cat">—</div>
            <div class="mqty"  id="vm-qty"></div>
          </div>
          <button class="modal-close" id="vm-close">✕</button>
        </div>
        <div class="inv-modal-body modal-body">
          <div id="vm-weapon" class="weapon-stats" style="display:none">
            <div class="ws-row"><span class="ws-label">Tipo de Dano</span><span class="ws-val" id="vm-wdmg">—</span></div>
            <div class="ws-row"><span class="ws-label">Dados de Dano</span><span class="ws-val" id="vm-wdice">—</span></div>
            <div class="ws-row"><span class="ws-label">Alcance</span><span class="ws-val" id="vm-wrange">—</span></div>
            <div class="ws-row"><span class="ws-label">Bônus Ataque</span><span class="ws-val" id="vm-watk">—</span></div>
            <div class="ws-row" style="grid-column:1/-1"><span class="ws-label">Propriedades</span><span class="ws-val" id="vm-wprops">—</span></div>
          </div>
          <hr class="modal-sep" id="vm-sep" style="display:none">
          <p class="modal-desc" id="vm-desc"></p>
          <div class="inv-modal-actions">
            <button class="btn-inv btn-inv-equip" id="vm-btn-equip">⚙ Equipar / Desequipar</button>
            <button class="btn-inv btn-inv-edit"  id="vm-btn-edit">✏ Editar</button>
            <button class="btn-inv btn-inv-close" id="vm-btn-close">Fechar</button>
            <button class="btn-inv btn-inv-delete" id="vm-btn-delete">🗑</button>
          </div>
        </div>
      </div>
    </div>`;

  // ── Add Modal ─────────────────────────────────────────────────────────────
  const _htmlAddModal = () => {
    const catOpts    = CATS.map(c=>`<option value="${c}" ${c===_activeCat?'selected':''}>${CAT_ICONS[c]} ${c}</option>`).join('');
    const typeOpts   = (TYPES[_activeCat]||['Outros']).map(t=>`<option>${t}</option>`).join('');
    const statusOpts = STATUSES.map(s=>`<option>${s}</option>`).join('');
    const dmgOpts    = DMG_TYPES.map(d=>`<option>${d}</option>`).join('');
    return `
      <div class="modal-overlay" id="inv-add-modal">
        <div class="modal-box" style="max-width:540px">
          <div class="modal-header">
            <span class="modal-title">✦ Registrar Novo Item</span>
            <button class="modal-close" id="add-close">✕</button>
          </div>
          <div class="modal-body" style="padding:0 1.2rem 1.2rem">
            <div class="form-group mt-2"><label>Nome *</label><input type="text" class="form-control" id="add-name" placeholder="Ex: Adaga das Sombras"></div>
            <div class="form-row2">
              <div class="form-group" style="margin-bottom:0"><label>Categoria</label><select class="form-control" id="add-cat">${catOpts}</select></div>
              <div class="form-group" style="margin-bottom:0"><label>Tipo</label><select class="form-control" id="add-type">${typeOpts}</select></div>
            </div>
            <div class="form-row2 mt-1">
              <div class="form-group" style="margin-bottom:0"><label>Quantidade</label><input type="number" class="form-control" id="add-qty" value="1" min="1"></div>
              <div class="form-group" style="margin-bottom:0"><label>Status</label><select class="form-control" id="add-status">${statusOpts}</select></div>
            </div>
            <div class="form-group mt-1"><label>Peso (kg/un)</label><input type="number" class="form-control" id="add-weight" value="0" min="0" step="0.1"></div>
            <div class="weapon-extra mt-1" id="add-weapon-extra">
              <div class="weapon-block">
                <p class="weapon-block-title">⚔ Atributos da Arma</p>
                <div class="form-row2">
                  <div class="form-group" style="margin-bottom:0"><label>Tipo de Dano</label><select class="form-control" id="add-wdmg">${dmgOpts}</select></div>
                  <div class="form-group" style="margin-bottom:0"><label>Dados</label><input type="text" class="form-control" id="add-wdice" placeholder="1d8+3"></div>
                </div>
                <div class="form-row2 mt-1">
                  <div class="form-group" style="margin-bottom:0"><label>Alcance</label><select class="form-control" id="add-wrange"><option>Corpo a corpo</option><option>Longa distância</option><option>Ambos</option></select></div>
                  <div class="form-group" style="margin-bottom:0"><label>Bônus Ataque</label><input type="text" class="form-control" id="add-watk" placeholder="+2"></div>
                </div>
                <div class="form-group mt-1" style="margin-bottom:0"><label>Propriedades</label><input type="text" class="form-control" id="add-wprops" placeholder="Versátil, Leve, Finesse..."></div>
              </div>
            </div>

            <div class="armor-extra mt-1" id="add-armor-extra" style="display:none">
              <div class="weapon-block" style="background:rgba(212,175,55,0.05);border-color:rgba(212,175,55,0.3)">
                <p class="weapon-block-title" style="color:var(--gold)">🛡 Atributos da Armadura</p>
                <div class="form-row2">
                  <div class="form-group" style="margin-bottom:0"><label>CA Base</label><input type="number" class="form-control" id="add-abase" value="10"></div>
                  <div class="form-group" style="margin-bottom:0"><label>Tipo</label><select class="form-control" id="add-atype"><option value="light">Leve (+DES total)</option><option value="medium">Média (máx +2 DES)</option><option value="heavy">Pesada (sem DES)</option></select></div>
                </div>
              </div>
            </div>

            <div class="form-group mt-1">
              <label>Imagem</label>
              <div class="upload-zone"><input type="file" id="add-img-file" accept="image/*"><p>📂 <b>Clique</b> ou arraste</p></div>
              <div class="img-preview-wrap"><div class="img-prev-box" id="add-img-prev">🎒</div><span class="img-fname" id="add-img-fname">Nenhuma imagem</span></div>
            </div>
            <div class="form-group mt-1"><label>Descrição</label><textarea class="form-control" id="add-desc" placeholder="Efeitos, bônus..."></textarea></div>
            <button class="btn-submit-inv" id="btn-commit-add">✦ Adicionar</button>
          </div>
        </div>
      </div>`;
  };

  // ── Edit Modal ────────────────────────────────────────────────────────────
  const _htmlEditModal = () => {
    const catOpts    = CATS.map(c=>`<option value="${c}">${CAT_ICONS[c]} ${c}</option>`).join('');
    const statusOpts = STATUSES.map(s=>`<option>${s}</option>`).join('');
    const dmgOpts    = DMG_TYPES.map(d=>`<option>${d}</option>`).join('');
    return `
      <div class="modal-overlay" id="inv-edit-modal">
        <div class="modal-box" style="max-width:540px">
          <div class="modal-header">
            <span class="modal-title" id="edit-modal-title">✏ Editar Item</span>
            <button class="modal-close" id="edit-close">✕</button>
          </div>
          <div class="modal-body" style="padding:0 1.2rem 1.2rem">
            <div class="form-group mt-2"><label>Nome *</label><input type="text" class="form-control" id="edit-name"></div>
            <div class="form-row2">
              <div class="form-group" style="margin-bottom:0"><label>Categoria</label><select class="form-control" id="edit-cat">${catOpts}</select></div>
              <div class="form-group" style="margin-bottom:0"><label>Tipo</label><select class="form-control" id="edit-type"></select></div>
            </div>
            <div class="form-row2 mt-1">
              <div class="form-group" style="margin-bottom:0"><label>Quantidade</label><input type="number" class="form-control" id="edit-qty" value="1" min="1"></div>
              <div class="form-group" style="margin-bottom:0"><label>Status</label><select class="form-control" id="edit-status">${statusOpts}</select></div>
            </div>
            <div class="form-group mt-1"><label>Peso (kg/un)</label><input type="number" class="form-control" id="edit-weight" value="0" min="0" step="0.1"></div>
            <div class="weapon-extra mt-1" id="edit-weapon-extra">
              <div class="weapon-block">
                <p class="weapon-block-title">⚔ Atributos da Arma</p>
                <div class="form-row2">
                  <div class="form-group" style="margin-bottom:0"><label>Tipo de Dano</label><select class="form-control" id="edit-wdmg">${dmgOpts}</select></div>
                  <div class="form-group" style="margin-bottom:0"><label>Dados</label><input type="text" class="form-control" id="edit-wdice" placeholder="1d8+3"></div>
                </div>
                <div class="form-row2 mt-1">
                  <div class="form-group" style="margin-bottom:0"><label>Alcance</label><select class="form-control" id="edit-wrange"><option>Corpo a corpo</option><option>Longa distância</option><option>Ambos</option></select></div>
                  <div class="form-group" style="margin-bottom:0"><label>Bônus Ataque</label><input type="text" class="form-control" id="edit-watk" placeholder="+2"></div>
                </div>
                <div class="form-group mt-1" style="margin-bottom:0"><label>Propriedades</label><input type="text" class="form-control" id="edit-wprops"></div>
              </div>
            </div>

            <div class="armor-extra mt-1" id="edit-armor-extra" style="display:none">
              <div class="weapon-block" style="background:rgba(212,175,55,0.05);border-color:rgba(212,175,55,0.3)">
                <p class="weapon-block-title" style="color:var(--gold)">🛡 Atributos da Armadura</p>
                <div class="form-row2">
                  <div class="form-group" style="margin-bottom:0"><label>CA Base</label><input type="number" class="form-control" id="edit-abase" value="10"></div>
                  <div class="form-group" style="margin-bottom:0"><label>Tipo</label><select class="form-control" id="edit-atype"><option value="light">Leve (+DES total)</option><option value="medium">Média (máx +2 DES)</option><option value="heavy">Pesada (sem DES)</option></select></div>
                </div>
              </div>
            </div>

            <div class="form-group mt-1">
              <label>Substituir Imagem</label>
              <div class="upload-zone"><input type="file" id="edit-img-file" accept="image/*"><p>📂 <b>Clique</b></p></div>
              <div class="img-preview-wrap"><div class="img-prev-box" id="edit-img-prev">🎒</div><span class="img-fname" id="edit-img-fname">Imagem atual</span></div>
            </div>
            <div class="form-group mt-1"><label>Descrição</label><textarea class="form-control" id="edit-desc"></textarea></div>
            <button class="btn-submit-inv" id="btn-commit-edit">✦ Salvar</button>
          </div>
        </div>
      </div>`;
  };

  // ══════════════════════════════════════════════════════════════════════════
  // EVENTS
  // ══════════════════════════════════════════════════════════════════════════
  const _attachAll = () => {
    _attachCoins(); _attachCatTabs(); _attachGrid();
    _attachViewModal(); _attachAddModal(); _attachEditModal();
  };

  const _attachCoins = () => {
    _panelEl.querySelectorAll('.cbtn[data-coin]').forEach(btn => {
      btn.addEventListener('click', () => {
        CharacterState.updateCoins(btn.dataset.coin, parseInt(btn.dataset.delta));
        _refreshCoins();
      });
    });
    _panelEl.querySelector('#qbtn-add')?.addEventListener('click', () => _quickCoin(1));
    _panelEl.querySelector('#qbtn-sub')?.addEventListener('click', () => _quickCoin(-1));
  };

  const _quickCoin = (sign) => {
    const amt = parseInt(_panelEl.querySelector('#coin-amt')?.value)||0;
    if (amt<=0) { Toast.show('Digite uma quantidade válida.'); return; }
    const key = _panelEl.querySelector('#coin-sel')?.value;
    CharacterState.updateCoins(key, sign*amt);
    _refreshCoins();
    Toast.show((sign>0?'+ Recebeu ':'− Gastou ')+amt+' '+COIN_NAMES[key]);
  };

  const _refreshCoins = () => {
    const c = CharacterState.get().coins||{};
    COIN_KEYS.forEach(k => {
      const el = _panelEl.querySelector(`#cv-${k}`);
      if (el) el.textContent = c[k]||0;
    });
    const el = _panelEl.querySelector('#po-equiv');
    if (el) el.innerHTML = `Equivalente total: <b>${CharacterState.getTotalPO().toFixed(2)} PO</b>`;
  };

  const _attachCatTabs = () => {
    _panelEl.querySelectorAll('.cat-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        _activeCat = btn.dataset.cat;
        _panelEl.querySelectorAll('.cat-btn').forEach(b=>b.classList.remove('active'));
        btn.classList.add('active');
        const lbl = _panelEl.querySelector('#cat-label-txt');
        if (lbl) lbl.textContent = `${CAT_ICONS[_activeCat]} ${_activeCat.toUpperCase()}`;
        const cnt = _panelEl.querySelector('#used-slots');
        if (cnt) cnt.textContent = CharacterState.getItemsByCategory(_activeCat).length;
        _refreshGrid();
      });
    });
    _panelEl.querySelector('#btn-open-add')?.addEventListener('click', () => {
      _panelEl.querySelector('#inv-add-modal')?.classList.add('open');
      const sel = _panelEl.querySelector('#add-cat');
      if (sel) { sel.value = _activeCat; _onAddCatChange(); }
      _panelEl.querySelector('#add-name')?.focus();
    });
  };

  const _attachGrid = () => {
    _panelEl.querySelectorAll('.slot').forEach(slot => {
      slot.addEventListener('click', () => {
        const idx   = parseInt(slot.dataset.slot);
        const items = CharacterState.getItemsByCategory(_activeCat);
        if (items[idx]) { _activeSlot = idx; _openViewModal(items[idx]); }
      });
    });
  };

  // ── View ──────────────────────────────────────────────────────────────────
  const _openViewModal = async (item) => {
    const modal = _panelEl.querySelector('#inv-view-modal');
    if (!modal) return;
    _panelEl.querySelector('#vm-name').textContent = item.name;
    _panelEl.querySelector('#vm-type').textContent = item.type||'—';
    _panelEl.querySelector('#vm-cat').textContent  = `${_activeCat} · ${item.status}`;
    _panelEl.querySelector('#vm-qty').textContent  = item.qty>1?`Quantidade: ${item.qty}`:'';
    _panelEl.querySelector('#vm-desc').textContent = item.desc||'';
    const imgEl = _panelEl.querySelector('#vm-img');
    if (item.img) {
      try {
        const base64 = await window.ImageStorage.get(item.img);
        imgEl.innerHTML = base64
          ? `<img src="${base64}" alt="${_esc(item.name)}">`
          : CAT_ICONS[_activeCat];
      } catch { imgEl.innerHTML = CAT_ICONS[_activeCat]; }
    } else {
      imgEl.innerHTML = CAT_ICONS[_activeCat];
    }
    const wBlock = _panelEl.querySelector('#vm-weapon');
    const wSep   = _panelEl.querySelector('#vm-sep');
    if (_activeCat==='Armas'&&item.wDice) {
      _panelEl.querySelector('#vm-wdmg').textContent   = item.wDmgType||'—';
      _panelEl.querySelector('#vm-wdice').textContent  = item.wDice||'—';
      _panelEl.querySelector('#vm-wrange').textContent = item.wRange||'—';
      _panelEl.querySelector('#vm-watk').textContent   = item.wAtk||'—';
      _panelEl.querySelector('#vm-wprops').textContent = item.wProps||'—';
      wBlock.style.display='grid'; wSep.style.display='block';
    } else { wBlock.style.display='none'; wSep.style.display='none'; }

    const equipBtn = _panelEl.querySelector('#vm-btn-equip');
    if (equipBtn) {
      const isEquipped = item.status === 'Equipado';
      equipBtn.textContent = isEquipped ? '⚙ Desequipar' : '⚙ Equipar';
      equipBtn.style.color = isEquipped ? 'var(--gold)' : 'var(--text-muted)';
    }
    modal.classList.add('open');
  };

  const _attachViewModal = () => {
    const modal = _panelEl.querySelector('#inv-view-modal');
    if (!modal) return;
    const close = () => modal.classList.remove('open');
    _panelEl.querySelector('#vm-close')?.addEventListener('click', close);
    _panelEl.querySelector('#vm-btn-close')?.addEventListener('click', close);
    modal.addEventListener('click', e => { if (e.target===modal) close(); });

    _panelEl.querySelector('#vm-btn-equip')?.addEventListener('click', () => {
      if (_activeSlot===null) return;
      const items = CharacterState.getItemsByCategory(_activeCat);
      const item  = items[_activeSlot];
      if (!item) return;

      const isEquipped = item.status === 'Equipado';
      const newStatus  = isEquipped ? 'Normal' : 'Equipado';

      if (!isEquipped) {
        // Enforce single armour rule
        if (item.type === 'Armadura') {
          items.forEach((it, i) => {
            if (it.type==='Armadura' && it.status==='Equipado' && i!==_activeSlot) {
              CharacterState.updateItem(_activeCat, it.id, { status:'Normal' });
              Toast.show(`${it.name} desequipada.`);
            }
          });
        }
        // --- NOVA TRAVA: Regra de escudo único ---
        if (item.type === 'Escudo') {
          items.forEach((it, i) => {
            if (it.type === 'Escudo' && it.status === 'Equipado' && i !== _activeSlot) {
              CharacterState.updateItem(_activeCat, it.id, { status: 'Normal' });
              Toast.show(`${it.name} desequipado para usar o novo.`);
            }
          });
        }
        // -----------------------------------------
        // Max 3 weapons
        if (_activeCat==='Armas') {
          const weapItems = CharacterState.getItemsByCategory('Armas');
          const equipped  = weapItems.filter(w => w.status==='Equipado');
          if (equipped.length >= 3) {
            Toast.show('Máximo de 3 armas equipadas.'); return;
          }
        }
      }

      CharacterState.updateItem(_activeCat, item.id, { status: newStatus });
      CharacterState.recalcAC();
      Toast.show(`${item.name} ${newStatus==='Equipado'?'equipada':'desequipada'}. CA recalculada.`);
      close(); _activeSlot=null; _refreshGrid();
    });

    _panelEl.querySelector('#vm-btn-delete')?.addEventListener('click', () => {
      if (_activeSlot===null) return;
      const item = CharacterState.getItemsByCategory(_activeCat)[_activeSlot];
      if (!item||!confirm(`Remover "${item.name}"?`)) return;
      CharacterState.deleteItem(_activeCat, item.id);
      Toast.show(`🗑 "${item.name}" removido.`);
      close(); _activeSlot=null; _refreshGrid();
    });

    _panelEl.querySelector('#vm-btn-edit')?.addEventListener('click', () => {
      if (_activeSlot===null) return;
      const item = CharacterState.getItemsByCategory(_activeCat)[_activeSlot];
      if (!item) return;
      close(); _openEditModal(item);
    });
  };

  // ── Add ───────────────────────────────────────────────────────────────────
  const _onAddCatChange = () => {
    const cat = _panelEl.querySelector('#add-cat')?.value;
    _panelEl.querySelector('#add-weapon-extra')?.classList.toggle('show', cat==='Armas');
    const typeEl = _panelEl.querySelector('#add-type');
    if (typeEl) {
      typeEl.innerHTML = (TYPES[cat]||['Outros']).map(t=>`<option>${t}</option>`).join('');
      // After repopulating, first option is selected — check it for armor panel
      const armorBox = _panelEl.querySelector('#add-armor-extra');
      if (armorBox) armorBox.style.display = typeEl.value === 'Armadura' ? 'block' : 'none';
    }
  };

  const _attachAddModal = () => {
    const modal = _panelEl.querySelector('#inv-add-modal');
    if (!modal) return;
    const close = () => { modal.classList.remove('open'); _pendingImgAdd=null; };
    _panelEl.querySelector('#add-close')?.addEventListener('click', close);
    modal.addEventListener('click', e=>{ if(e.target===modal) close(); });
    _panelEl.querySelector('#add-cat')?.addEventListener('change', _onAddCatChange);
    _panelEl.querySelector('#add-img-file')?.addEventListener('change', e=>_handleUpload(e,'add-img-prev','add-img-fname','add'));
    _panelEl.querySelector('#btn-commit-add')?.addEventListener('click', _commitAdd);
    _panelEl.querySelector('#add-type')?.addEventListener('change', (e) => {
      const armorBox = _panelEl.querySelector('#add-armor-extra');
      if (armorBox) armorBox.style.display = e.target.value === 'Armadura' ? 'block' : 'none';
    });
  };

  const _commitAdd = () => {
    const cat  = _panelEl.querySelector('#add-cat')?.value||_activeCat;
    const name = _panelEl.querySelector('#add-name')?.value.trim();
    if (!name) { Toast.show('Digite o nome do item.'); return; }
    if (CharacterState.getItemsByCategory(cat).length>=CharacterState.SLOTS_MAX) {
      Toast.show(`Slots cheios em ${cat}!`); return;
    }
    const item = {
      name, type:_panelEl.querySelector('#add-type')?.value||'Outros',
      qty:parseInt(_panelEl.querySelector('#add-qty')?.value)||1,
      status:_panelEl.querySelector('#add-status')?.value||'Normal',
      desc:_panelEl.querySelector('#add-desc')?.value.trim()||'',
      weight:parseFloat(_panelEl.querySelector('#add-weight')?.value)||0,
      img:_pendingImgAdd||null
    };
    if (cat==='Armas') {
      item.wDmgType=_panelEl.querySelector('#add-wdmg')?.value||'';
      item.wDice=_panelEl.querySelector('#add-wdice')?.value.trim()||'';
      item.wRange=_panelEl.querySelector('#add-wrange')?.value||'';
      item.wAtk=_panelEl.querySelector('#add-watk')?.value.trim()||'';
      item.wProps=_panelEl.querySelector('#add-wprops')?.value.trim()||'';
    }
    if (item.type === 'Armadura') {
      item.aBaseAC = parseInt(_panelEl.querySelector('#add-abase')?.value) || 10;
      item.aType   = _panelEl.querySelector('#add-atype')?.value || 'light';
    }
    if (!CharacterState.addItem(cat,item)) { Toast.show('Erro.'); return; }
    Toast.show(`✦ "${name}" adicionado!`);
    _pendingImgAdd=null;
    ['add-name','add-desc','add-wdice','add-watk','add-wprops'].forEach(id=>{const el=_panelEl.querySelector(`#${id}`);if(el)el.value='';});
    const qEl=_panelEl.querySelector('#add-qty');if(qEl)qEl.value='1';
    const pEl=_panelEl.querySelector('#add-img-prev');if(pEl)pEl.innerHTML='🎒';
    const fEl=_panelEl.querySelector('#add-img-fname');if(fEl)fEl.textContent='Nenhuma imagem';
    const abEl=_panelEl.querySelector('#add-abase');if(abEl)abEl.value='10';
    const atEl=_panelEl.querySelector('#add-atype');if(atEl)atEl.value='light';
    const armorBox=_panelEl.querySelector('#add-armor-extra');if(armorBox)armorBox.style.display='none';
    _activeCat=cat;
    _panelEl.querySelector('#inv-add-modal')?.classList.remove('open');
    _panelEl.querySelectorAll('.cat-btn').forEach(b=>b.classList.toggle('active',b.dataset.cat===_activeCat));
    _refreshGrid();
  };

  // ── Edit ──────────────────────────────────────────────────────────────────
  const _openEditModal = (item) => {
    const modal = _panelEl.querySelector('#inv-edit-modal');
    if (!modal) return;
    _pendingImgEdit=null;
    _panelEl.querySelector('#edit-name').value   = item.name||'';
    _panelEl.querySelector('#edit-qty').value    = item.qty||1;
    _panelEl.querySelector('#edit-cat').value    = _activeCat;
    _panelEl.querySelector('#edit-desc').value   = item.desc||'';
    _panelEl.querySelector('#edit-weight').value = item.weight||0;
    const typeEl = _panelEl.querySelector('#edit-type');
    typeEl.innerHTML=(TYPES[_activeCat]||['Outros']).map(t=>`<option>${t}</option>`).join('');
    typeEl.value=item.type||'Outros';
    _panelEl.querySelector('#edit-status').value=item.status||'Normal';
    const pEl=_panelEl.querySelector('#edit-img-prev');
    if (item.img) {
      window.ImageStorage.get(item.img).then(base64 => {
        pEl.innerHTML = base64 ? `<img src="${base64}">` : CAT_ICONS[_activeCat];
      }).catch(() => { pEl.innerHTML = CAT_ICONS[_activeCat]; });
    } else {
      pEl.innerHTML = CAT_ICONS[_activeCat];
    }
    _panelEl.querySelector('#edit-img-fname').textContent=item.img?'Imagem atual':'Sem imagem';
    const wExtra=_panelEl.querySelector('#edit-weapon-extra');
    wExtra.classList.toggle('show',_activeCat==='Armas');
    if (_activeCat==='Armas') {
      _panelEl.querySelector('#edit-wdmg').value  =item.wDmgType||'Cortante';
      _panelEl.querySelector('#edit-wdice').value =item.wDice||'';
      _panelEl.querySelector('#edit-wrange').value=item.wRange||'Corpo a corpo';
      _panelEl.querySelector('#edit-watk').value  =item.wAtk||'';
      _panelEl.querySelector('#edit-wprops').value=item.wProps||'';
    }
    const aExtra = _panelEl.querySelector('#edit-armor-extra');
    if (aExtra) aExtra.style.display = item.type === 'Armadura' ? 'block' : 'none';
    if (item.type === 'Armadura') {
      _panelEl.querySelector('#edit-abase').value = item.aBaseAC || 10;
      _panelEl.querySelector('#edit-atype').value = item.aType || 'light';
    }
    modal.classList.add('open');
  };

  const _onEditCatChange = () => {
    const cat = _panelEl.querySelector('#edit-cat')?.value;
    _panelEl.querySelector('#edit-weapon-extra')?.classList.toggle('show', cat==='Armas');
    const typeEl = _panelEl.querySelector('#edit-type');
    if (typeEl) {
      typeEl.innerHTML = (TYPES[cat]||['Outros']).map(t=>`<option>${t}</option>`).join('');
      const armorBox = _panelEl.querySelector('#edit-armor-extra');
      if (armorBox) armorBox.style.display = typeEl.value === 'Armadura' ? 'block' : 'none';
    }
  };

  const _attachEditModal = () => {
    const modal=_panelEl.querySelector('#inv-edit-modal');
    if(!modal)return;
    const close=()=>{ modal.classList.remove('open'); _pendingImgEdit=null; };
    _panelEl.querySelector('#edit-close')?.addEventListener('click',close);
    modal.addEventListener('click',e=>{ if(e.target===modal)close(); });
    _panelEl.querySelector('#edit-cat')?.addEventListener('change',_onEditCatChange);
    _panelEl.querySelector('#edit-img-file')?.addEventListener('change',e=>_handleUpload(e,'edit-img-prev','edit-img-fname','edit'));
    _panelEl.querySelector('#btn-commit-edit')?.addEventListener('click',_commitEdit);
    _panelEl.querySelector('#edit-type')?.addEventListener('change', (e) => {
      const armorBox = _panelEl.querySelector('#edit-armor-extra');
      if (armorBox) armorBox.style.display = e.target.value === 'Armadura' ? 'block' : 'none';
    });
  };

  const _commitEdit = () => {
    if (_activeSlot===null) return;
    const item=CharacterState.getItemsByCategory(_activeCat)[_activeSlot];
    if(!item)return;
    const newCat=_panelEl.querySelector('#edit-cat')?.value;
    const name=_panelEl.querySelector('#edit-name')?.value.trim()||item.name;
    const updated={
      name, type:_panelEl.querySelector('#edit-type')?.value||item.type,
      qty:parseInt(_panelEl.querySelector('#edit-qty')?.value)||1,
      status:_panelEl.querySelector('#edit-status')?.value||item.status,
      desc:_panelEl.querySelector('#edit-desc')?.value.trim()||'',
      weight:parseFloat(_panelEl.querySelector('#edit-weight')?.value)||0,
      img:_pendingImgEdit!==null?_pendingImgEdit:item.img
    };
    if(newCat==='Armas'){
      updated.wDmgType=_panelEl.querySelector('#edit-wdmg')?.value||'';
      updated.wDice=_panelEl.querySelector('#edit-wdice')?.value.trim()||'';
      updated.wRange=_panelEl.querySelector('#edit-wrange')?.value||'';
      updated.wAtk=_panelEl.querySelector('#edit-watk')?.value.trim()||'';
      updated.wProps=_panelEl.querySelector('#edit-wprops')?.value.trim()||'';
    }
    if (updated.type === 'Armadura') {
      updated.aBaseAC = parseInt(_panelEl.querySelector('#edit-abase')?.value) || 10;
      updated.aType   = _panelEl.querySelector('#edit-atype')?.value || 'light';
    }
    const ok=CharacterState.updateItem(_activeCat,item.id,updated,newCat!==_activeCat?newCat:null);
    if(!ok){Toast.show('Slots cheios!');return;}
    if(newCat!==_activeCat){
      _activeCat=newCat;
      _panelEl.querySelectorAll('.cat-btn').forEach(b=>b.classList.toggle('active',b.dataset.cat===_activeCat));
    }
    CharacterState.recalcAC();
    Toast.show(`✏ "${name}" atualizado.`);
    _pendingImgEdit=null; _activeSlot=null;
    _panelEl.querySelector('#inv-edit-modal')?.classList.remove('open');
    _refreshGrid();
  };

  // ── Upload ────────────────────────────────────────────────────────────────
  const _handleUpload = (e, prevId, fnameId, mode) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      
      // 1. Adicionado 'async' na declaração da função
      img.onload = async () => { 
        const canvas = document.createElement('canvas');
        const MAX_SIZE = 128; 
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_SIZE) { height *= MAX_SIZE / width; width = MAX_SIZE; }
        } else {
          if (height > MAX_SIZE) { width *= MAX_SIZE / height; height = MAX_SIZE; }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        // Variável com a string Base64 pesada
        const data = canvas.toDataURL('image/jpeg', 0.7);

        // ==========================================
        // NOVO FLUXO: SALVAMENTO NO INDEXED DB
        // ==========================================
        const uniqueImageId = 'img_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
        
        try {
            await ImageStorage.save(uniqueImageId, data);
            
            // Agora as variáveis pendentes guardam apenas o ID leve
            if (mode === 'add') _pendingImgAdd = uniqueImageId;
            else _pendingImgEdit = uniqueImageId;
            
        } catch (error) {
            console.error("Falha ao salvar imagem no cache assíncrono", error);
            // Em caso de erro, anula a operação para não corromper o inventário
            if (mode === 'add') _pendingImgAdd = null;
            else _pendingImgEdit = null;
            return;
        }
        // ==========================================

        const pEl = _panelEl.querySelector(`#${prevId}`);
        // O preview visual continua usando o Base64 ('data') porque precisa renderizar imediatamente na tela
        if (pEl) pEl.innerHTML = `<img src="${data}">`; 
        const fEl = _panelEl.querySelector(`#${fnameId}`);
        if (fEl) fEl.textContent = file.name;
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  };

  // ── Grid refresh ──────────────────────────────────────────────────────────
  const _refreshGrid=()=>{
    const oldGrid=_panelEl.querySelector('#inv-grid');
    if(oldGrid){const tmp=document.createElement('div');tmp.innerHTML=_htmlGrid();oldGrid.replaceWith(tmp.firstElementChild);_attachGrid();}
    const cnt=_panelEl.querySelector('#used-slots');
    if(cnt)cnt.textContent=CharacterState.getItemsByCategory(_activeCat).length;
    // refresh carry bar — replace first card safely
    const carryCard = _panelEl.querySelector('.card');
    if (carryCard) {
      const tmp = document.createElement('div');
      tmp.innerHTML = _htmlCarryBar();
      carryCard.replaceWith(tmp.firstElementChild);
    }
  };

  const _esc=(s)=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

  // ── Refresh Item Icons ───────────────────────────────────────────────────
  const refreshItemIcons = async () => {
    const images = _panelEl ? _panelEl.querySelectorAll('img[data-image-id]') : [];
    for (const img of images) {
      const imageId = img.getAttribute('data-image-id');
      // Usa getAttribute para evitar o problema de img.src retornar a URL base da página
      if (img.getAttribute('src') || !imageId) continue;
      try {
        const base64 = await window.ImageStorage.get(imageId);
        if (base64) img.src = base64;
      } catch (err) {
        console.error('Erro ao carregar imagem do IndexedDB:', err);
      }
    }
  };

  return { init, render };
})();