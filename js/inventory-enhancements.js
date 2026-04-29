/**
 * inventory-enhancements.js
 * Módulo de melhorias para o inventário do Codex
 *
 * DESACOPLADO: usa MutationObserver para detectar adições ao DOM
 * e aplicar raridade + tooltips sem precisar ser invocado manualmente.
 */

export const InventoryEnhancements = (() => {

  let _tooltip   = null;
  let _statusBar = null;
  const _observers = new WeakMap();

  const RARITY_MAP = {
    'comum':'rarity-comum','incomum':'rarity-incomum','raro':'rarity-raro',
    'épico':'rarity-epico','epico':'rarity-epico',
    'lendário':'rarity-lendario','lendario':'rarity-lendario',
    'artefato':'rarity-artefato',
    'common':'rarity-comum','uncommon':'rarity-incomum','rare':'rarity-raro',
    'epic':'rarity-epico','legendary':'rarity-lendario','artifact':'rarity-artefato',
  };

  const RARITY_LABELS = {
    'rarity-comum':'Comum','rarity-incomum':'Incomum','rarity-raro':'Raro',
    'rarity-epico':'Épico','rarity-lendario':'Lendário','rarity-artefato':'Artefato',
  };

  const _ensureTooltip = () => {
    if (_tooltip && document.body.contains(_tooltip)) return _tooltip;
    _tooltip = document.createElement('div');
    _tooltip.className = 'inv-slot-tooltip';
    _tooltip.setAttribute('aria-hidden', 'true');
    _tooltip.innerHTML = `<div class="tt-name"></div><div class="tt-type"></div><div class="tt-qty"></div>`;
    document.body.appendChild(_tooltip);
    return _tooltip;
  };

  const _positionTooltip = (e) => {
    if (!_tooltip) return;
    const tt=_tooltip, vw=window.innerWidth, ttW=tt.offsetWidth||180, ttH=tt.offsetHeight||50, margin=12;
    let x=e.clientX+margin, y=e.clientY-ttH-margin;
    if (x+ttW>vw-8) x=e.clientX-ttW-margin;
    if (y<8) y=e.clientY+margin;
    tt.style.left=`${x}px`; tt.style.top=`${y}px`;
  };

  const _showTooltip = (slotEl, e) => {
    const tt=_ensureTooltip();
    const name=slotEl.dataset.itemName||slotEl.title||'—';
    const type=slotEl.dataset.itemType||'';
    const qty=slotEl.dataset.itemQty;
    const rar=slotEl.dataset.itemRarity||'';
    const rarLabel=RARITY_LABELS[rar]||'';
    const typeLabel=[rarLabel,type].filter(Boolean).join(' · ');
    tt.querySelector('.tt-name').textContent=name;
    tt.querySelector('.tt-type').textContent=typeLabel;
    tt.querySelector('.tt-qty').textContent=qty>1?`Qtd: ${qty}`:'';
    const rarColors={'rarity-raro':'rgba(50,120,230,0.6)','rarity-epico':'rgba(160,60,220,0.6)','rarity-lendario':'rgba(255,160,30,0.7)','rarity-artefato':'rgba(255,80,80,0.65)'};
    tt.style.borderColor=rarColors[rar]||'var(--border-gold)';
    _positionTooltip(e);
    tt.classList.add('visible');
  };

  const _hideTooltip = () => { _tooltip?.classList.remove('visible'); };

  const _updateStatusBar = (slotEl, active) => {
    if (!_statusBar) return;
    if (!active) { _statusBar.innerHTML=`<span style="opacity:0.35;font-style:italic">Passe o mouse sobre um item…</span>`; return; }
    const name=slotEl.dataset.itemName||'—';
    const type=slotEl.dataset.itemType||'';
    const cat=slotEl.dataset.catName||'';
    const qty=slotEl.dataset.itemQty;
    const rar=slotEl.dataset.itemRarity||'';
    const rarLabel=RARITY_LABELS[rar]||'';
    _statusBar.innerHTML=`
      <span class="isb-name">${name}</span>
      ${type?`<span class="isb-sep">·</span><span class="isb-cat">${type}</span>`:''}
      ${cat?`<span class="isb-sep">·</span><span class="isb-cat">${cat}</span>`:''}
      ${rarLabel?`<span class="isb-sep">·</span><span class="isb-cat" style="color:var(--text-arcane)">${rarLabel}</span>`:''}
      ${qty>1?`<span class="isb-sep">·</span><span class="isb-cat">x${qty}</span>`:''}`;
  };

  const _injectStatusBar = (gridEl) => {
    const parent=gridEl.closest('.inventory-section')||gridEl.parentElement;
    const existing=parent?.querySelector('.inv-status-bar');
    if (existing) { _statusBar=existing; return; }
    _statusBar=document.createElement('div');
    _statusBar.className='inv-status-bar';
    _statusBar.innerHTML=`<span style="opacity:0.35;font-style:italic">Passe o mouse sobre um item…</span>`;
    gridEl.insertAdjacentElement('afterend',_statusBar);
  };

  const bindTooltips = (containerEl) => {
    const isMobile=window.matchMedia('(max-width:600px)').matches;
    containerEl.querySelectorAll('.slot.filled:not(.tooltip-bound)').forEach(slot => {
      slot.classList.add('tooltip-bound');
      slot.addEventListener('mouseenter',(e)=>{ if(!isMobile)_showTooltip(slot,e); _updateStatusBar(slot,true); });
      slot.addEventListener('mousemove',(e)=>{ if(!isMobile)_positionTooltip(e); });
      slot.addEventListener('mouseleave',()=>{ _hideTooltip(); _updateStatusBar(null,false); });
    });
  };

  const applyRarityClasses = (gridEl) => {
    const RARITY_CLASSES=Object.values(RARITY_MAP);
    gridEl.querySelectorAll('.slot.filled').forEach(slot => {
      slot.classList.remove(...RARITY_CLASSES);
      const raw=(slot.dataset.itemRarity||'').toLowerCase().trim();
      const cls=RARITY_MAP[raw];
      if (cls) {
        slot.classList.add(cls);
        slot.dataset.rarityClass=cls;
        if (!slot.querySelector('.rarity-badge')) {
          const badge=document.createElement('span');
          badge.className='rarity-badge';
          badge.setAttribute('aria-label',RARITY_LABELS[cls]||'');
          slot.appendChild(badge);
        }
      }
    });
  };

  /**
   * MutationObserver autônomo — aplica raridade+tooltips automaticamente
   * a cada re-renderização do grid, sem chamadas manuais externas.
   */
  const _attachObserver = (containerEl) => {
    if (_observers.has(containerEl)) return;
    const observer = new MutationObserver((mutations) => {
      let needsUpdate=false;
      for (const m of mutations) {
        if (m.type==='childList'&&m.addedNodes.length>0) { needsUpdate=true; break; }
      }
      if (!needsUpdate) return;
      containerEl.querySelectorAll('.inventory-grid').forEach(grid => {
        applyRarityClasses(grid);
        bindTooltips(grid);
      });
    });
    observer.observe(containerEl,{childList:true,subtree:true});
    _observers.set(containerEl,observer);
  };

  const init = (containerEl) => {
    const grids=containerEl.querySelectorAll('.inventory-grid');
    if (grids.length) {
      _injectStatusBar(grids[0]);
      grids.forEach(grid=>{ applyRarityClasses(grid); bindTooltips(grid); });
    }
    _attachObserver(containerEl);
    document.addEventListener('scroll',_hideTooltip,{passive:true});
  };

  const disconnect = (containerEl) => {
    const obs=_observers.get(containerEl);
    if (obs) { obs.disconnect(); _observers.delete(containerEl); }
  };

  const getRarityClass = (rarityStr) => RARITY_MAP[(rarityStr||'').toLowerCase().trim()]||'';

  return { init, disconnect, bindTooltips, applyRarityClasses, getRarityClass, RARITY_MAP, RARITY_LABELS };
})();
