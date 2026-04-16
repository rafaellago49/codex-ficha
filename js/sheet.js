/**
 * sheet.js — Main Character Sheet Renderer v4
 * Novidades: Modal de Level-Up híbrido (virtual/físico/média), ASI toast
 */

import { CharacterState, DataLoader, Toast, fmt, CASTER_TYPE, CASTING_ATTR, getMaxPrepared, HIT_DIE_BY_CLASS } from './app.js';
import { InventoryModule } from './inventory.js';

const ATTR_LABELS = {
  str: { abbr: 'FOR', full: 'Força' },
  dex: { abbr: 'DES', full: 'Destreza' },
  con: { abbr: 'CON', full: 'Constituição' },
  int: { abbr: 'INT', full: 'Inteligência' },
  wis: { abbr: 'SAB', full: 'Sabedoria' },
  cha: { abbr: 'CAR', full: 'Carisma' }
};

const SKILLS = [
  { id:'acrobatics',     label:'Acrobacia',        attr:'dex' },
  { id:'animal-handling',label:'Lidar c/ Animais',  attr:'wis' },
  { id:'arcana',         label:'Arcanismo',         attr:'int' },
  { id:'athletics',      label:'Atletismo',         attr:'str' },
  { id:'deception',      label:'Enganação',         attr:'cha' },
  { id:'history',        label:'História',          attr:'int' },
  { id:'insight',        label:'Intuição',          attr:'wis' },
  { id:'intimidation',   label:'Intimidação',       attr:'cha' },
  { id:'investigation',  label:'Investigação',      attr:'int' },
  { id:'medicine',       label:'Medicina',          attr:'wis' },
  { id:'nature',         label:'Natureza',          attr:'int' },
  { id:'perception',     label:'Percepção',         attr:'wis' },
  { id:'performance',    label:'Atuação',           attr:'cha' },
  { id:'persuasion',     label:'Persuasão',         attr:'cha' },
  { id:'religion',       label:'Religião',          attr:'int' },
  { id:'sleight-of-hand',   label:'Prestidigitação',   attr:'dex' },
  { id:'stealth',        label:'Furtividade',       attr:'dex' },
  { id:'survival',       label:'Sobrevivência',     attr:'wis' }
];

const SPELL_LVL_LABELS = {
  0:'Truques', 1:'1º', 2:'2º', 3:'3º', 4:'4º',
  5:'5º', 6:'6º', 7:'7º', 8:'8º', 9:'9º'
};

export const Sheet = (() => {
  let _viewEl     = null;
  let _activeTab  = 'registro';
  let _spells     = [];
  let _spellFilter = 'all';

  // ── Public ───────────────────────────────────────────────────────────────
  const init = async (viewEl) => {
    _viewEl = viewEl;
    _spells = await DataLoader.load('./data/spells.json') || [];
    _render();
  };

  // ── Shell ─────────────────────────────────────────────────────────────────
  const _render = () => {
    const state = CharacterState.get();
    const id    = state.identity;
    const prof  = CharacterState.getProficiencyBonus();

    _viewEl.innerHTML = `
      <div class="sheet-topbar">
        <div class="topbar-left">
          <div>
            <div class="topbar-char-name">${id.name || 'Personagem'}</div>
            <div class="topbar-char-sub">
              ${id.race||''}${id.race&&id.class?' · ':''}${id.class||''}
              ${id.level ? ` · Nível ${id.level}` : ''}
              ${prof ? ` · Prof. +${prof}` : ''}
            </div>
          </div>
        </div>
        <div class="topbar-right">
          <button class="btn btn-secondary btn-sm" id="btn-short-rest">⛺ D. Curto</button>
          <button class="btn btn-secondary btn-sm" id="btn-long-rest">☾ D. Longo</button>
          <button class="btn btn-secondary btn-sm" id="btn-export">💾 Exportar</button>
          <button class="btn btn-ghost btn-sm" id="btn-home-back" title="Início">⌂</button>
        </div>
      </div>

      <div class="sheet-tabs">
        <button class="sheet-tab ${_activeTab==='registro'?'active':''}"   data-tab="registro">Registro</button>
        <button class="sheet-tab ${_activeTab==='inventario'?'active':''}" data-tab="inventario">Inventário</button>
        <button class="sheet-tab ${_activeTab==='grimorio'?'active':''}"   data-tab="grimorio">Grimório</button>
      </div>

      <div class="sheet-body">
        <div class="sheet-panel ${_activeTab==='registro'?'active':''}"   id="panel-registro"></div>
        <div class="sheet-panel ${_activeTab==='inventario'?'active':''}" id="panel-inventario"></div>
        <div class="sheet-panel ${_activeTab==='grimorio'?'active':''}"   id="panel-grimorio"></div>
      </div>`;

    _attachTopbar();
    _attachTabs();
    _renderActivePanel();
  };

  const _renderActivePanel = () => {
    if (_activeTab === 'registro')   _renderRegistro();
    if (_activeTab === 'inventario') _renderInventario();
    if (_activeTab === 'grimorio')   _renderGrimorio();
  };

  const _attachTabs = () => {
    _viewEl.querySelectorAll('.sheet-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        const target = btn.dataset.tab;
        if (_activeTab === target) return; // Evita re-renderizar a mesma aba

        _activeTab = target;
        _viewEl.querySelectorAll('.sheet-tab').forEach(b => b.classList.remove('active'));
        _viewEl.querySelectorAll('.sheet-panel').forEach(p => {
            p.classList.remove('active');
            p.innerHTML = ''; // Limpa o painel anterior para evitar IDs duplicados
        });

        btn.classList.add('active');
        const panel = document.getElementById(`panel-${_activeTab}`);
        if (panel) {
            panel.classList.add('active');
            _renderActivePanel();
        }
      });
    });
  };

  // ── Topbar ────────────────────────────────────────────────────────────────
  const _attachTopbar = () => {
    document.getElementById('btn-export')?.addEventListener('click', () => {
      CharacterState.exportJSON(); Toast.show('✦ Ficha exportada.');
    });

    document.getElementById('btn-long-rest')?.addEventListener('click', () => {
      if (!confirm('Realizar Descanso Longo?\n— HP restaurado ao máximo\n— Todos os Spell Slots recuperados\n— 50% dos Dados de Vida recuperados')) return;
      const state = CharacterState.get();
      const totalDice = state.identity.level || 1;
      const usedDice  = state.combat?.hitDiceUsed || 0;
      const recovered = Math.max(1, Math.floor(totalDice / 2));
      CharacterState.patch({
        combat: {
          ...state.combat,
          hp: { ...state.combat.hp, current: state.combat.hp.max, temp: 0 },
          hitDiceUsed: Math.max(0, usedDice - recovered),
          deathSaves: { successes:[false,false,false], failures:[false,false,false] }
        }
      });
      CharacterState.resetSpellSlots();
      Toast.show('☾ Descanso Longo realizado. Completamente restaurado!');
      _renderActivePanel();
    });

    document.getElementById('btn-short-rest')?.addEventListener('click', () => {
      const state     = CharacterState.get();
      const level     = state.identity.level || 1;
      const used      = state.combat?.hitDiceUsed || 0;
      const available = level - used;
      if (available <= 0) { Toast.show('Sem Dados de Vida disponíveis.'); return; }
      const sides  = HIT_DIE_BY_CLASS[state.identity?.classId]
        || parseInt((state.combat?.hitDice || '1d8').replace(/^\d*d/, ''))
        || 8;
      const conMod = CharacterState.getModifier('con');
      const conTxt = conMod >= 0 ? `+${conMod}` : `${conMod}`;
      const isWarlock = CASTER_TYPE[state.identity?.classId] === 'pact';

      // Remove modal anterior se existir
      document.getElementById('short-rest-modal-overlay')?.remove();

      const overlay = document.createElement('div');
      overlay.id = 'short-rest-modal-overlay';
      overlay.className = 'modal-overlay';
      overlay.innerHTML = `
        <div class="modal-box" style="max-width:360px" role="dialog" aria-modal="true">
          <div class="modal-header">
            <div class="modal-title">⛺ Descanso Curto</div>
            <button class="modal-close-btn" id="sr-modal-close">✕</button>
          </div>
          <div class="modal-body">
            <p style="font-size:0.88rem;color:var(--text-muted);margin-bottom:1rem">
              Dados de Vida disponíveis:
              <strong style="color:var(--gold)">${available}</strong> / ${level}
              &nbsp;·&nbsp; d${sides} ${conTxt} CON
              ${isWarlock ? '<br><span style="color:var(--arcane-bright);font-size:0.8rem">✦ Warlock: slots de pacto recuperados</span>' : ''}
            </p>
            <div style="display:flex;align-items:center;gap:0.75rem;justify-content:center;margin-bottom:1rem">
              <label style="color:var(--text-muted);font-size:0.88rem">Gastar:</label>
              <button class="cbtn" id="sr-down" style="width:28px;height:28px">−</button>
              <span id="sr-count" style="font-family:var(--font-heading);font-size:1.5rem;color:var(--gold);min-width:28px;text-align:center">1</span>
              <button class="cbtn" id="sr-up" style="width:28px;height:28px">+</button>
              <span style="color:var(--text-muted);font-size:0.85rem">dado(s)</span>
            </div>
            <div class="lu-result-display" id="sr-preview" style="text-align:center;padding:0.75rem;background:var(--bg-input);border-radius:8px;border:1px solid var(--border-faint)">
              <span style="font-size:0.82rem;color:var(--text-dim)">Clique em Confirmar para rolar</span>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-ghost btn-sm" id="sr-cancel">Cancelar</button>
            <button class="btn btn-primary" id="sr-confirm">⛺ Confirmar</button>
          </div>
        </div>`;
      document.body.appendChild(overlay);
      overlay.classList.add('open');

      let srCount = 1;
      const countEl   = overlay.querySelector('#sr-count');
      const previewEl = overlay.querySelector('#sr-preview');

      const _updatePreview = () => {
        const hp = CharacterState.get().combat.hp;
        const maxGain = hp.max - hp.current;
        const avgTotal = srCount * (Math.floor(sides / 2) + 1 + conMod);
        const capped   = Math.min(Math.max(0, avgTotal), maxGain);
        previewEl.innerHTML = `
          <span style="font-size:0.8rem;color:var(--text-muted)">
            Estimativa: <strong style="color:var(--gold)">+${capped}</strong> HP
            <span style="font-size:0.72rem">(${srCount}d${sides}${conTxt} CON, cap ${maxGain})</span>
          </span>`;
      };
      _updatePreview();

      overlay.querySelector('#sr-up').addEventListener('click', () => {
        if (srCount < available) { srCount++; countEl.textContent = srCount; _updatePreview(); }
      });
      overlay.querySelector('#sr-down').addEventListener('click', () => {
        if (srCount > 1) { srCount--; countEl.textContent = srCount; _updatePreview(); }
      });

      const _close = () => overlay.remove();
      overlay.querySelector('#sr-modal-close').addEventListener('click', _close);
      overlay.querySelector('#sr-cancel').addEventListener('click', _close);
      overlay.addEventListener('click', e => { if (e.target === overlay) _close(); });

      overlay.querySelector('#sr-confirm').addEventListener('click', () => {
        const n = Math.min(srCount, available);
        let total = 0;
        for (let i = 0; i < n; i++) total += Math.floor(Math.random() * sides) + 1 + conMod;
        total = Math.max(0, total);
        const st  = CharacterState.get();
        const hp  = st.combat.hp;
        const newHP    = Math.min(hp.current + total, hp.max);
        const hpGained = newHP - hp.current;
        CharacterState.patch({
          combat: { ...st.combat, hp: { ...hp, current: newHP }, hitDiceUsed: (st.combat?.hitDiceUsed || 0) + n }
        });
        CharacterState.resetPactSlots();
        _close();
        Toast.show(`⛺ Descanso Curto: +${hpGained} HP (${n}d${sides}${conTxt} CON)`);
        _renderActivePanel();
      });
    });

    document.getElementById('btn-home-back')?.addEventListener('click', () => {
      if (confirm('Voltar ao início? Dados salvos.'))
        window.dispatchEvent(new CustomEvent('navigate-home'));
    });
  };

  // ══════════════════════════════════════════════════════════════════════════
  // PANEL 1 — REGISTRO
  // ══════════════════════════════════════════════════════════════════════════
  const _renderRegistro = () => {
    const el = document.getElementById('panel-registro');
    if (!el) return;

    el.innerHTML = `
      <div class="registro-grid">
        <div>
          ${_htmlAttrBlock()}
          ${_htmlSavesBlock()}
          ${_htmlSkillsBlock()}
          ${_htmlProfBlock()}
        </div>
        <div>
          ${_htmlLevelBlock()}
          ${_htmlCombatBlock()}
          ${_htmlHPBlock()}
          ${_htmlDeathSaves()}
          ${_htmlAttacksBlock()}
          ${_htmlSpellSlotsBlock()}
          ${_htmlResourcesBlock()}
          ${_htmlFeaturesBlock()}
        </div>
        <div>
          ${_htmlTraitsBlock()}
          ${_htmlDiaryBlock()}
        </div>
      </div>`;

    _attachRegistroListeners(el);
  };

  // ── Atributos ─────────────────────────────────────────────────────────────
  const _htmlAttrBlock = () => {
    const passivePerc = CharacterState.getPassivePerception();
    const boxes = Object.entries(ATTR_LABELS).map(([key, lbl]) => {
      const total = CharacterState.getTotalAttr(key);
      const mod   = CharacterState.getModifier(key);
      return `
        <div class="attr-display-box" data-attr="${key}">
          <div class="attr-abbr">${lbl.abbr}</div>
          <input type="number" class="attr-score-input" data-attr-key="${key}" value="${total}" min="1" max="30">
          <div class="attr-modifier">${fmt.modifier(mod)}</div>
        </div>`;
    }).join('');

    return `
      <div class="card mb-2">
        <div class="card-title">Atributos</div>
        <div class="attr-display-grid">${boxes}</div>
        <div class="divider"></div>
        <div class="form-row" style="gap:0.5rem">
          <div class="form-group" style="margin-bottom:0">
            <label>Inspiração</label>
            <input type="text" class="form-control" id="sheet-inspiration" value="${CharacterState.get().combat?.inspiration||''}" placeholder="—">
          </div>
          <div class="form-group" style="margin-bottom:0">
            <label>Proficiência</label>
            <input type="text" class="form-control" value="+${CharacterState.getProficiencyBonus()}" readonly>
          </div>
        </div>
        <div style="margin-top:0.6rem;font-size:0.85rem;color:var(--text-muted)">
          Percepção Passiva: <strong style="color:var(--gold)">${passivePerc}</strong>
        </div>
      </div>`;
  };

  // ── Salvaguardas ──────────────────────────────────────────────────────────
  const _htmlSavesBlock = () => {
    const prof = CharacterState.get().savingThrows?.proficient || [];
    const items = ['str','dex','con','int','wis','cha'].map(k => {
      const mod = CharacterState.getSaveMod(k);
      const chk = prof.includes(k);
      return `
        <div class="save-item">
          <input type="checkbox" data-save="${k}" ${chk?'checked':''} disabled>
          <span>${ATTR_LABELS[k].abbr}</span>
          <span style="color:var(--gold-dim);font-family:var(--font-heading);font-size:0.8rem">${fmt.modifier(mod)}</span>
        </div>`;
    }).join('');
    return `<div class="card mb-2"><div class="card-title">Salvaguardas</div><div class="save-grid">${items}</div></div>`;
  };

  // ── Perícias ──────────────────────────────────────────────────────────────
  const _htmlSkillsBlock = () => {
    const state = CharacterState.get();
    const prof = state.skills?.proficient || [];
    const exp  = state.skills?.expertise || [];
    
    const rows = SKILLS.map(s => {
      const mod = CharacterState.getSkillMod(s.id);
      const isProf = prof.includes(s.id);
      const isExp  = exp.includes(s.id);
      return `
        <div class="skill-row-item">
          <label class="skill-check">
            <input type="checkbox" ${isProf?'checked':''} disabled>
            <span>${s.label}</span>
            <span style="font-size:0.75rem;color:var(--text-dim);margin-left:0.3rem">(${ATTR_LABELS[s.attr].abbr})</span>
          </label>
          <div style="display:flex;align-items:center;gap:0.4rem">
            <button class="btn-ghost" data-skill-exp="${s.id}" title="Especialização"
                    style="padding:0 2px; font-size:1.1rem; line-height:1; color:${isExp?'var(--gold)':'var(--border-faint)'}; cursor:pointer">
              ★
            </button>
            <span class="skill-mod" style="min-width:28px;text-align:right">${fmt.modifier(mod)}</span>
          </div>
        </div>`;
    }).join('');

    return `
      <div class="card mb-2">
        <div class="card-title" style="display:flex;justify-content:space-between">
          <span>Perícias</span>
          <span style="font-size:0.65rem;color:var(--text-dim);text-transform:none">★ Especialização</span>
        </div>
        <div class="skill-list">${rows}</div>
      </div>`;
  };

  // ── Proficiências ─────────────────────────────────────────────────────────
  const _htmlProfBlock = () => {
    const p = CharacterState.get().proficiencies || {};
    return `
      <div class="card mb-2">
        <div class="card-title">Proficiências & Idiomas</div>
        <div class="form-group mb-1"><label>Armaduras</label>
          <textarea class="form-control" style="min-height:42px" data-field="proficiencies.armor">${p.armor||''}</textarea></div>
        <div class="form-group mb-1"><label>Armas</label>
          <textarea class="form-control" style="min-height:42px" data-field="proficiencies.weapons">${p.weapons||''}</textarea></div>
        <div class="form-group mb-1"><label>Ferramentas</label>
          <textarea class="form-control" style="min-height:42px" data-field="proficiencies.tools">${p.tools||''}</textarea></div>
        <div class="form-group mb-0"><label>Idiomas</label>
          <textarea class="form-control" style="min-height:42px" data-field="proficiencies.languages">${p.languages||''}</textarea></div>
      </div>`;
  };

  // ── Level Block ───────────────────────────────────────────────────────────
  const _htmlLevelBlock = () => {
    const id = CharacterState.get().identity;
    return `
      <div class="card mb-2">
        <div class="card-title" style="display:flex;justify-content:space-between;align-items:center">
          <span>Nível & Evolução</span>
          <button class="btn btn-primary btn-sm" id="btn-level-up">↑ Subir Nível</button>
        </div>
        <div style="display:flex;gap:1rem;align-items:center;flex-wrap:wrap;font-size:0.9rem">
          <div>Nível: <strong style="color:var(--gold);font-family:var(--font-heading)">${id.level||1}</strong></div>
          <div>Classe: <strong style="color:var(--text-primary)">${id.class||'—'}</strong></div>
          <div>Antecedente: <span style="color:var(--text-muted)">${id.background||'—'}</span></div>
        </div>
        <div style="margin-top:0.5rem;display:flex;align-items:center;gap:0.75rem;font-size:0.88rem">
          <label style="color:var(--text-muted)">XP:</label>
          <input type="number" class="form-control" id="sheet-xp" value="${id.xp||0}" min="0" style="width:90px">
        </div>
      </div>`;
  };

  // ── Combate ───────────────────────────────────────────────────────────────
  const _htmlCombatBlock = () => {
    const c   = CharacterState.get().combat || {};
    const ini = CharacterState.getModifier('dex');
    return `
      <div class="card mb-2">
        <div class="card-title">Combate</div>
        <div class="combat-row">
          <div class="combat-stat-box">
            <input type="number" class="val" id="sheet-ac" value="${c.ac||10}">
            <div class="lbl-sm">C.A.</div>
          </div>
          <div class="combat-stat-box">
            <div class="val" style="font-family:var(--font-heading);font-size:1.25rem;color:var(--gold)">${fmt.modifier(ini)}</div>
            <div class="lbl-sm">Iniciativa</div>
          </div>
          <div class="combat-stat-box">
            <input type="text" class="val" id="sheet-speed" value="${c.speed||9}m" style="width:100%">
            <div class="lbl-sm">Deslocamento</div>
          </div>
        </div>
        <div class="form-row mt-1" style="gap:0.5rem">
          <div>
            <label style="font-family:var(--font-heading);font-size:0.65rem;text-transform:uppercase;letter-spacing:1.5px;color:var(--text-muted)">Dados de Vida</label>
            <input type="text" class="form-control" id="sheet-hitdice" value="${c.hitDice||'1d8'}">
          </div>
          <div>
            <label style="font-family:var(--font-heading);font-size:0.65rem;text-transform:uppercase;letter-spacing:1.5px;color:var(--text-muted)">DV Gastos</label>
            <input type="number" class="form-control" id="sheet-hitdice-used" value="${c.hitDiceUsed||0}" min="0">
          </div>
        </div>
      </div>`;
  };

  // ── HP ────────────────────────────────────────────────────────────────────
  const _htmlHPBlock = () => {
    const hp  = CharacterState.get().combat?.hp || { current:10, max:10, temp:0 };
    const pct = Math.max(0, Math.min(100, (hp.current / (hp.max||1)) * 100));
    const barColor = pct > 50 ? 'var(--hp-bar-from)' : pct > 25 ? '#e09320' : 'var(--crimson-bright)';
    return `
      <div class="card mb-2">
        <div class="card-title">Pontos de Vida</div>
        <div class="hp-bar-wrap">
          <div class="hp-bar-fill" id="hp-bar-fill" style="width:${pct}%;background:${barColor}"></div>
        </div>
        <div class="hp-inputs">
          <span>Atual:</span>
          <input type="number" class="hp-input" id="hp-current" value="${hp.current}">
          <span>/</span>
          <input type="number" class="hp-input" id="hp-max" value="${hp.max}">
          <span style="margin-left:0.75rem;color:var(--text-muted)">Temp:</span>
          <input type="number" class="hp-input" id="hp-temp" value="${hp.temp||0}">
        </div>
      </div>`;
  };

  // ── Death Saves ───────────────────────────────────────────────────────────
  const _htmlDeathSaves = () => {
    const hp = CharacterState.get().combat?.hp || { current:10 };
    const ds = CharacterState.get().combat?.deathSaves || { successes:[false,false,false], failures:[false,false,false] };
    const visible = hp.current <= 0;
    const succ = ds.successes.map((v,i) =>
      `<input type="checkbox" data-ds="success-${i}" ${v?'checked':''}>`).join(' ');
    const fail = ds.failures.map((v,i) =>
      `<input type="checkbox" data-ds="failure-${i}" ${v?'checked':''}>`).join(' ');
    return `
      <div class="card mb-2" id="death-saves-block" ${visible?'':'style="display:none"'}>
        <div class="card-title">☠ Testes Contra a Morte</div>
        <div class="death-saves">
          <div class="ds-group">✓ Sucesso: ${succ}</div>
          <div class="ds-group">✕ Falha: ${fail}</div>
        </div>
      </div>`;
  };

  // ── Ataques ───────────────────────────────────────────────────────────────
  const _htmlAttacksBlock = () => {
    const attacks = CharacterState.getEquippedAttacks();
    const rows = attacks.length > 0 ? attacks.map(a => `
      <div class="attack-row-display">
        <span class="atk-name-disp">${a.name}</span>
        <span class="atk-bonus-disp badge badge-gold">${a.bonus}</span>
        <span class="atk-dmg-disp">${a.damage}</span>
        ${a.props ? `<span style="font-size:0.72rem;color:var(--text-dim)">${a.props}</span>` : ''}
      </div>`).join('')
    : `<p style="font-size:0.82rem;color:var(--text-dim);font-style:italic">Equipe armas no Inventário para ver ataques aqui.</p>`;
    return `<div class="card mb-2"><div class="card-title">Ataques</div>${rows}</div>`;
  };

  // ── Spell Slots ───────────────────────────────────────────────────────────
  const _htmlSpellSlotsBlock = () => {
    const slots = CharacterState.get().spells?.slots || {};
    const classId = CharacterState.get().identity?.classId;
    if (!classId || CASTER_TYPE[classId] === 'none' || Object.keys(slots).length === 0) return '';

    const rows = Object.entries(slots).sort((a,b) => +a[0] - +b[0]).map(([lvl, s]) => {
      const boxes = Array.from({length:s.max}, (_,i) => `
        <input type="checkbox" class="slot-check" data-slot-lvl="${lvl}" data-slot-idx="${i}"
               ${i < s.used ? 'checked' : ''}>`).join('');
      return `
        <div class="slot-row">
          <span class="slot-lbl">${SPELL_LVL_LABELS[lvl]||lvl+'º'}</span>
          <div class="slot-boxes">${boxes}</div>
        </div>`;
    }).join('');

    return `
      <div class="card mb-2">
        <div class="card-title">Espaços de Magia</div>
        <div class="slot-grid">${rows}</div>
      </div>`;
  };

  // ── Recursos ──────────────────────────────────────────────────────────────
  const _htmlResourcesBlock = () => {
    const resources = CharacterState.get().resources || [];
    const rows = resources.length > 0
      ? resources.map((r,i) => `
          <div class="resource-item">
            <span class="resource-name">${r.name}</span>
            <div class="resource-controls">
              <input type="number" class="resource-val" data-res-idx="${i}" data-res-field="current" value="${r.current}" min="0">
              <span style="color:var(--text-dim)">/</span>
              <input type="number" class="resource-val" data-res-idx="${i}" data-res-field="max" value="${r.max}" min="0">
            </div>
          </div>`).join('')
      : `<p class="text-muted" style="font-size:0.85rem;font-style:italic">Nenhum recurso cadastrado.</p>`;
    return `
      <div class="card mb-2">
        <div class="card-title" style="display:flex;justify-content:space-between;align-items:center">
          Recursos de Classe <button class="btn btn-ghost btn-sm" id="btn-add-resource">+ Recurso</button>
        </div>
        <div id="resources-list">${rows}</div>
      </div>`;
  };

  // ── Características ───────────────────────────────────────────────────────
  const _htmlFeaturesBlock = () => `
    <div class="card mb-2">
      <div class="card-title">Características & Talentos</div>
      <textarea class="diary-textarea" data-field="features" style="min-height:120px">${CharacterState.get().features||''}</textarea>
    </div>`;

  // ── Traços ────────────────────────────────────────────────────────────────
  const _htmlTraitsBlock = () => {
    const t = CharacterState.get().traits || {};
    const fields = [
      { field:'traits.personality', label:'Traços de Personalidade', val:t.personality||'' },
      { field:'traits.ideals',      label:'Ideais',                   val:t.ideals||'' },
      { field:'traits.bonds',       label:'Vínculos',                 val:t.bonds||'' },
      { field:'traits.flaws',       label:'Defeitos',                 val:t.flaws||'' },
      { field:'traits.backstory',   label:'História',                 val:t.backstory||'' }
    ];
    return `
      <div class="card mb-2">
        <div class="card-title">Personalidade & História</div>
        ${fields.map(f=>`
          <div class="form-group mb-1"><label>${f.label}</label>
            <textarea class="form-control" data-field="${f.field}" style="min-height:55px">${f.val}</textarea>
          </div>`).join('')}
      </div>`;
  };

  // ── Diário ────────────────────────────────────────────────────────────────
  const _htmlDiaryBlock = () => {
    const d = CharacterState.get().diary || {};
    return `
      <div class="card mb-2">
        <div class="card-title">Diário de Campanha</div>
        <div class="diary-layout">
          <div class="form-group mb-0"><label>Notas Gerais</label>
            <textarea class="diary-textarea" data-field="diary.notes">${d.notes||''}</textarea></div>
          <div class="form-group mb-0"><label>Sessão / Campanha</label>
            <textarea class="diary-textarea" data-field="diary.campaign">${d.campaign||''}</textarea></div>
        </div>
        <div class="form-group mt-1 mb-0"><label>Aliados & Organizações</label>
          <textarea class="form-control" data-field="diary.allies" style="min-height:70px">${d.allies||''}</textarea></div>
      </div>`;
  };

  // ══════════════════════════════════════════════════════════════════════════
  // LEVEL-UP MODAL — Hybrid HP (average / virtual / manual)
  // ══════════════════════════════════════════════════════════════════════════
  const _openLevelUpModal = () => {
    const state      = CharacterState.get();
    const curLevel   = state.identity.level || 1;
    const nextLevel  = curLevel + 1;
    if (nextLevel > 20) { Toast.show('Nível máximo (20) atingido.'); return; }

    const hitDieSides = HIT_DIE_BY_CLASS[state.identity?.classId]
      || parseInt((state.combat?.hitDice || '1d8').replace(/^\d*d/, ''))
      || 8;
    const conMod      = CharacterState.getModifier('con');
    const avgGain     = Math.max(1, Math.floor(hitDieSides / 2) + 1 + conMod);
    const conTxt      = conMod >= 0 ? `+${conMod}` : `${conMod}`;

    // Inject modal
    const existing = document.getElementById('levelup-modal-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'levelup-modal-overlay';
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal-box" id="levelup-modal-box" role="dialog" aria-modal="true" aria-label="Subir de Nível">
        <div class="modal-header">
          <div class="modal-title">↑ Subir para Nível ${nextLevel}</div>
          <button class="modal-close-btn" id="levelup-modal-close" aria-label="Fechar">✕</button>
        </div>
        <div class="modal-body">
          <p style="font-size:0.9rem;color:var(--text-muted);margin-bottom:1rem">
            Dado de Vida: <strong style="color:var(--gold)">d${hitDieSides}</strong>
            &nbsp;·&nbsp; Mod. CON: <strong style="color:var(--gold)">${conTxt}</strong>
          </p>

          <!-- Method tabs -->
          <div class="lu-method-tabs">
            <button class="lu-method-btn active" data-method="average">
              📊 Média Oficial
            </button>
            <button class="lu-method-btn" data-method="virtual">
              🎲 Rolar Virtualmente
            </button>
            <button class="lu-method-btn" data-method="manual">
              ✍ Dado Físico
            </button>
          </div>

          <!-- Average panel -->
          <div class="lu-panel" id="lu-panel-average">
            <div class="lu-result-display" id="lu-avg-display">
              <span style="font-size:2.5rem;font-family:var(--font-heading);color:var(--gold)">${avgGain}</span>
              <span style="font-size:0.85rem;color:var(--text-muted);display:block">HP ganhos<br>(⌊${hitDieSides}/2⌋+1 ${conTxt} CON)</span>
            </div>
          </div>

          <!-- Virtual panel -->
          <div class="lu-panel" id="lu-panel-virtual" style="display:none">
            <div class="lu-result-display" id="lu-virtual-display">
              <span style="font-size:2.5rem;font-family:var(--font-heading);color:var(--gold)" id="lu-virtual-num">—</span>
              <span style="font-size:0.85rem;color:var(--text-muted);display:block" id="lu-virtual-sub">Clique para rolar</span>
            </div>
            <button class="btn btn-secondary btn-sm" id="lu-roll-btn" style="margin-top:0.75rem">🎲 Rolar 1d${hitDieSides}</button>
          </div>

          <!-- Manual (physical dice) panel -->
          <div class="lu-panel" id="lu-panel-manual" style="display:none">
            <p style="font-size:0.85rem;color:var(--text-muted);margin-bottom:0.6rem">
              Role seu d${hitDieSides} físico e insira o resultado:
            </p>
            <div style="display:flex;align-items:center;gap:0.6rem;justify-content:center">
              <input type="number" id="lu-manual-input" class="form-control"
                style="width:90px;text-align:center;font-size:1.4rem;font-family:var(--font-heading)"
                min="1" max="${hitDieSides}" placeholder="—">
              <span style="color:var(--text-muted);font-size:0.85rem">de 1 – ${hitDieSides}</span>
            </div>
            <div class="lu-result-display" id="lu-manual-display" style="margin-top:0.75rem;display:none">
              <span style="font-size:2.5rem;font-family:var(--font-heading);color:var(--gold)" id="lu-manual-num">—</span>
              <span style="font-size:0.85rem;color:var(--text-muted);display:block" id="lu-manual-sub">HP ganhos (dado + CON)</span>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn btn-ghost btn-sm" id="levelup-cancel">Cancelar</button>
          <button class="btn btn-primary" id="levelup-confirm">⚡ Confirmar Subida</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.classList.add('open');   // ← adicionar esta linha

    // State
    let selectedMethod = 'average';
    let virtualRolled  = null; // the raw die result (before CON)
    let manualRolled   = null; // the raw die result entered by user

    // ── Method switching ─────────────────────────────────────────────────
    const _switchMethod = (method) => {
      selectedMethod = method;
      overlay.querySelectorAll('.lu-method-btn').forEach(b =>
        b.classList.toggle('active', b.dataset.method === method));
      ['average','virtual','manual'].forEach(m => {
        const panel = document.getElementById(`lu-panel-${m}`);
        if (panel) panel.style.display = m === method ? '' : 'none';
      });
    };

    overlay.querySelectorAll('.lu-method-btn').forEach(btn => {
      btn.addEventListener('click', () => _switchMethod(btn.dataset.method));
    });

    // ── Virtual roll ─────────────────────────────────────────────────────
    document.getElementById('lu-roll-btn')?.addEventListener('click', () => {
      virtualRolled = Math.floor(Math.random() * hitDieSides) + 1;
      const total   = Math.max(1, virtualRolled + conMod);
      const numEl   = document.getElementById('lu-virtual-num');
      const subEl   = document.getElementById('lu-virtual-sub');
      if (numEl) {
        numEl.textContent = total;
        numEl.style.color = virtualRolled === hitDieSides ? 'var(--gold-bright)'
                          : virtualRolled === 1           ? 'var(--crimson-bright)'
                          : 'var(--gold)';
      }
      if (subEl) subEl.textContent = `d${hitDieSides} = ${virtualRolled} ${conMod >= 0 ? '+' : ''}${conMod} CON = ${total} HP`;
    });

    // ── Manual input ─────────────────────────────────────────────────────
    document.getElementById('lu-manual-input')?.addEventListener('input', (e) => {
      const raw = parseInt(e.target.value);
      const display  = document.getElementById('lu-manual-display');
      const numEl    = document.getElementById('lu-manual-num');
      const subEl    = document.getElementById('lu-manual-sub');
      if (!raw || raw < 1 || raw > hitDieSides) {
        manualRolled = null;
        if (display) display.style.display = 'none';
        return;
      }
      manualRolled = raw;
      const total  = Math.max(1, raw + conMod);
      if (numEl) {
        numEl.textContent = total;
        numEl.style.color = raw === hitDieSides ? 'var(--gold-bright)'
                          : raw === 1           ? 'var(--crimson-bright)'
                          : 'var(--gold)';
      }
      if (subEl) subEl.textContent = `d${hitDieSides} = ${raw} ${conMod >= 0 ? '+' : ''}${conMod} CON = ${total} HP`;
      if (display) display.style.display = '';
    });

    // ── Confirm ──────────────────────────────────────────────────────────
    document.getElementById('levelup-confirm')?.addEventListener('click', async () => {
      if (selectedMethod === 'virtual' && virtualRolled === null) {
        Toast.show('Role o dado virtual primeiro! 🎲'); return;
      }
      if (selectedMethod === 'manual') {
        const raw = parseInt(document.getElementById('lu-manual-input')?.value);
        if (!raw || raw < 1 || raw > hitDieSides) {
          Toast.show(`⚠ Insira um valor válido (1–${hitDieSides})`); return;
        }
        manualRolled = raw;
      }

      const confirmBtn = document.getElementById('levelup-confirm');
      if (confirmBtn) { confirmBtn.disabled = true; confirmBtn.textContent = 'Aguarde…'; }

      try {
        const hpMode = selectedMethod;
        const manualVal = selectedMethod === 'manual' ? (manualRolled || 1) : 0;
        const result = await CharacterState.levelUp(hpMode, manualVal);

        overlay.remove();

        if (!result) {
          Toast.show('Nível máximo (20) atingido.'); return;
        }

        // Success toast
        const sourceLabel = hpMode === 'average' ? 'Média'
                          : hpMode === 'virtual' ? `d${hitDieSides}=${virtualRolled}`
                          : `Físico=${manualRolled}`;
        Toast.show(`🆙 Nível ${result.newLevel}! +${result.hpGain} HP (${sourceLabel}) · Prof. +${result.newProf}`);

        // Features toast
        if (result.featureText) {
          setTimeout(() => Toast.show(`✦ ${result.featureText}`, 5000), 400);
        }

        // ASI toast
        if (result.needsASI) {
          setTimeout(() => Toast.show('⭐ Nível ASI! Adicione +2 a um atributo ou +1 a dois na aba de Registro.', 6000), 900);
        }

        _render();
      } catch(err) {
        console.error('LevelUp error:', err);
        Toast.show('Erro ao subir de nível. Verifique o console.');
        const btn = document.getElementById('levelup-confirm');
        if (btn) { btn.disabled = false; btn.textContent = '⚡ Confirmar Subida'; }
      }
    });

    // ── Close ─────────────────────────────────────────────────────────────
    const _close = () => overlay.remove();
    document.getElementById('levelup-modal-close')?.addEventListener('click', _close);
    document.getElementById('levelup-cancel')?.addEventListener('click', _close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) _close(); });
  };

  // ── Listeners: Registro ──────────────────────────────────────────────────
  const _attachRegistroListeners = (el) => {
    // 1. Campos de texto (Nome, XP, etc)
    el.querySelectorAll('[data-field]').forEach(inp => {
      inp.addEventListener('change', () => CharacterState.set(inp.dataset.field, inp.value));
    }); // FECHA o ciclo de campos de texto

    // 2. Edição manual de Atributos
    el.querySelectorAll('.attr-score-input').forEach(inp => {
      inp.addEventListener('change', e => {
        const key      = e.target.dataset.attrKey;
        const newTotal = parseInt(e.target.value) || 10;
        const state    = CharacterState.get();
        const racial   = state.attributes[key].racialBonus || 0;
        CharacterState.set(`attributes.${key}.base`, newTotal - racial);
        CharacterState.recalcAC();
        _renderRegistro();
      });
    }); // FECHA o ciclo de atributos

    // 3. Clique na Estrela de Especialização (Expertise)
    el.querySelectorAll('[data-skill-exp]').forEach(btn => {
      btn.addEventListener('click', () => {
        const sid = btn.dataset.skillExp;
        const state = CharacterState.get();
        const prof = state.skills?.proficient || [];
        let exp = [...(state.skills?.expertise || [])];

        // Validação: Só permite especialização se já for proficiente
        if (!prof.includes(sid)) {
          Toast.show('Você só pode se especializar em uma perícia que já possui proficiência.');
          return;
        }

        if (exp.includes(sid)) {
          exp = exp.filter(id => id !== sid);
        } else {
          exp.push(sid);
        }

        CharacterState.set('skills.expertise', exp);
        _renderRegistro(); // Recarrega para atualizar a cor da estrela e os números
      });
    });

    // Level Up — opens hybrid modal
el.querySelector('#btn-level-up')?.addEventListener('click', _openLevelUpModal);

    // HP
    const hpCurrent = document.getElementById('hp-current');
    const hpMax     = document.getElementById('hp-max');
    const hpTemp    = document.getElementById('hp-temp');
    const updateHP  = () => {
      const cur = parseInt(hpCurrent?.value) || 0;
      const max = parseInt(hpMax?.value) || 1;
      const tmp = parseInt(hpTemp?.value) || 0;
      const pct = Math.max(0, Math.min(100, (cur/max)*100));
      const barColor = pct > 50 ? 'var(--hp-bar-from)' : pct > 25 ? '#e09320' : 'var(--crimson-bright)';
      const bar = document.getElementById('hp-bar-fill');
      
      if (bar) { 
        bar.style.width = `${pct}%`; 
        bar.style.background = barColor; 
      }

      // Preparar objeto de atualização
      const combatUpdate = { 
        ...CharacterState.get().combat, 
        hp: { current: cur, max, temp: tmp } 
      };

      // Lógica de limpeza: Se recuperou vida (HP > 0), limpa os testes contra a morte
      if (cur > 0) {
        combatUpdate.deathSaves = { 
          successes: [false, false, false], 
          failures: [false, false, false] 
        };
        // Desmarcar checkboxes visualmente na interface
        el.querySelectorAll('[data-ds]').forEach(chk => chk.checked = false);
      }

      CharacterState.patch({ combat: combatUpdate });

      const dsBlock = document.getElementById('death-saves-block');
      if (dsBlock) dsBlock.style.display = cur <= 0 ? 'block' : 'none';
    };
    [hpCurrent, hpMax, hpTemp].forEach(e => e?.addEventListener('input', updateHP));

    // Combat
    document.getElementById('sheet-ac')?.addEventListener('change', e =>
      CharacterState.set('combat.ac', parseInt(e.target.value)||10));
    document.getElementById('sheet-speed')?.addEventListener('change', e =>
      CharacterState.set('combat.speed', e.target.value));
    document.getElementById('sheet-hitdice')?.addEventListener('change', e =>
      CharacterState.set('combat.hitDice', e.target.value));
    document.getElementById('sheet-hitdice-used')?.addEventListener('change', e =>
      CharacterState.set('combat.hitDiceUsed', parseInt(e.target.value)||0));
    document.getElementById('sheet-xp')?.addEventListener('change', e =>
      CharacterState.set('identity.xp', parseInt(e.target.value)||0));
    document.getElementById('sheet-inspiration')?.addEventListener('change', e =>
      CharacterState.set('combat.inspiration', e.target.value));

    // Spell slot checkboxes
    el.querySelectorAll('.slot-check').forEach(chk => {
      chk.addEventListener('change', () => {
        const lvl  = parseInt(chk.dataset.slotLvl);
        const slots = CharacterState.get().spells?.slots || {};
        const k    = String(lvl);
        if (!slots[k]) return;
        const allInLevel = el.querySelectorAll(`.slot-check[data-slot-lvl="${lvl}"]`);
        let used = 0;
        allInLevel.forEach(c => { if (c.checked) used++; });
        CharacterState.set(`spells.slots.${k}.used`, used);
      });
    });

    // Death saves
    el.querySelectorAll('[data-ds]').forEach(chk => {
      chk.addEventListener('change', () => {
        const [type, idxStr] = chk.dataset.ds.split('-');
        const idx   = parseInt(idxStr);
        const state = CharacterState.get();
        const ds    = JSON.parse(JSON.stringify(state.combat?.deathSaves ||
          { successes:[false,false,false], failures:[false,false,false] }));
        if (type === 'success') ds.successes[idx] = chk.checked;
        else ds.failures[idx] = chk.checked;
        CharacterState.set('combat.deathSaves', ds);
        if (ds.failures.every(Boolean)) Toast.show('💀 Personagem morreu!');
        if (ds.successes.every(Boolean)) Toast.show('💚 Personagem estabilizou!');
      });
    });

    // Resources
    document.getElementById('btn-add-resource')?.addEventListener('click', () => {
      const name = prompt('Nome do recurso:');
      if (!name?.trim()) return;
      const max = parseInt(prompt('Valor máximo:')) || 1;
      const res = [...(CharacterState.get().resources||[]), { name: name.trim(), current: max, max }];
      CharacterState.set('resources', res);
      _renderRegistro();
    });

    el.querySelectorAll('[data-res-idx]').forEach(inp => {
      inp.addEventListener('change', () => {
        const idx   = parseInt(inp.dataset.resIdx);
        const field = inp.dataset.resField;
        const res   = [...(CharacterState.get().resources||[])];
        if (res[idx]) { res[idx][field] = Math.max(0, parseInt(inp.value)||0); CharacterState.set('resources', res); }
      });
    });
  };

  // ══════════════════════════════════════════════════════════════════════════
  // PANEL 2 — INVENTÁRIO
  // ══════════════════════════════════════════════════════════════════════════
  const _renderInventario = () => {
    const el = document.getElementById('panel-inventario');
    if (!el) return;
    InventoryModule.init(el);
  };

  // ══════════════════════════════════════════════════════════════════════════
  // PANEL 3 — GRIMÓRIO
  // ══════════════════════════════════════════════════════════════════════════
  const _renderGrimorio = () => {
    const el = document.getElementById('panel-grimorio');
    if (!el) return;

    const state    = CharacterState.get();
    const classId  = state.identity?.classId || '';
    const prepared = state.spells?.prepared || [];

    const classMap = {
      barbarian:'Bárbaro', bard:'Bardo', cleric:'Clérigo', druid:'Druida',
      fighter:'Guerreiro', monk:'Monge', paladin:'Paladino', ranger:'Patrulheiro',
      rogue:'Ladino', sorcerer:'Feiticeiro', warlock:'Bruxo', wizard:'Mago'
    };
    const className  = classMap[classId] || '';
    const classSpells = className ? _spells.filter(s => s.classes?.includes(className)) : _spells;

    const castAttr = CASTING_ATTR[classId] || 'int';
    const castMod  = CharacterState.getModifier(castAttr);
    const maxPrep  = getMaxPrepared(classId, state.identity?.level||1, castMod);

    const slots = state.spells?.slots || {};
    const availLevels = new Set(Object.keys(slots).map(Number));
    availLevels.add(0);

    const levels = [...new Set(classSpells.map(s=>s.level))].sort((a,b)=>a-b);
    const filterOpts = [
      `<option value="all" ${_spellFilter==='all'?'selected':''}>Todos</option>`,
      ...levels.map(l => `<option value="${l}" ${_spellFilter==l?'selected':''}>${SPELL_LVL_LABELS[l]||'Nível '+l}</option>`)
    ].join('');

    const filtered = _spellFilter === 'all' ? classSpells
      : classSpells.filter(s => s.level === parseInt(_spellFilter));

    const grouped = {};
    filtered.forEach(s => { if (!grouped[s.level]) grouped[s.level]=[]; grouped[s.level].push(s); });

    const spellListHtml = Object.entries(grouped).sort((a,b)=>+a[0]-+b[0]).map(([lvl,spells]) => {
      const items = spells.map(s => {
        const isPrepared = prepared.includes(s.id);
        const hasSlot    = s.level === 0 || availLevels.has(s.level);
        return `
          <div class="spell-entry ${isPrepared?'prepared':''}" id="spell-${s.id}">
            <input type="checkbox" class="spell-checkbox" data-spell-id="${s.id}"
                   ${isPrepared?'checked':''} ${!hasSlot&&s.level>0?'title="Sem slots disponíveis"':''}>
            <div class="spell-info">
              <div class="spell-name">${s.name}</div>
              <div class="spell-meta">
                <span class="badge badge-gold">${SPELL_LVL_LABELS[s.level]||'Truque'}</span>
                <span class="badge badge-arcane">${s.school}</span>
                <span style="font-size:0.78rem;color:var(--text-dim)">${s.castingTime}</span>
              </div>
              <div class="spell-desc-text">${s.description}</div>
              <button class="spell-toggle" data-spell-toggle="${s.id}">▸ Detalhes</button>
            </div>
          </div>`;
      }).join('');
      return `
        <div style="margin-bottom:1.25rem">
          <div style="font-family:var(--font-heading);font-size:0.72rem;text-transform:uppercase;letter-spacing:2px;color:var(--gold-dim);margin-bottom:0.5rem;padding-bottom:0.35rem;border-bottom:1px solid var(--border-faint)">
            ${SPELL_LVL_LABELS[lvl]||'Nível '+lvl}</div>
          ${items}
        </div>`;
    }).join('');

    const activeItems = prepared.length > 0
      ? prepared.map(id => {
          const s = _spells.find(sp => sp.id === id);
          return s ? `<div class="active-spell-item">
            <span class="active-spell-name">${s.name}</span>
            <span class="active-spell-level">${SPELL_LVL_LABELS[s.level]||'Truque'}</span>
          </div>` : '';
        }).join('')
      : `<div class="spells-empty">Nenhuma magia preparada.</div>`;

    const prepInfo = maxPrep !== null
      ? `<div style="font-size:0.82rem;color:var(--text-muted);margin-bottom:0.5rem">
           Máx. preparadas: <strong style="color:var(--gold)">${maxPrep}</strong>
           · Preparadas: <strong style="color:${prepared.filter(id => { const s = _spells.find(sp=>sp.id===id); return s&&s.level>0; }).length > maxPrep?'var(--crimson-bright)':'var(--gold-bright)'}">${prepared.filter(id => { const s = _spells.find(sp=>sp.id===id); return s&&s.level>0; }).length}</strong>
         </div>`
      : '';

    el.innerHTML = `
      <div class="grimoire-layout">
        <div>
          ${prepInfo}
          <div class="spell-filters">
            <span class="filter-label">Filtrar:</span>
            <select class="filter-select" id="spell-level-filter">${filterOpts}</select>
            <span style="font-size:0.82rem;color:var(--text-muted)">${classSpells.length} magias</span>
          </div>
          <div id="spell-list-container">${spellListHtml}</div>
        </div>
        <div class="active-spells-panel">
          <div class="card" style="position:sticky;top:1rem">
            <div class="card-title" id="active-spells-title">✦ Preparadas (${prepared.length})</div>
            <div id="active-spells-list">${activeItems}</div>
          </div>
        </div>
      </div>`;

    document.getElementById('spell-level-filter')?.addEventListener('change', e => {
      _spellFilter = e.target.value; _renderGrimorio();
    });

    el.querySelectorAll('.spell-checkbox').forEach(chk => {
      chk.addEventListener('change', () => {
        const id = chk.dataset.spellId;
        const sp = _spells.find(s => s.id === id);
        if (chk.checked) {
          if (sp && sp.level > 0 && maxPrep !== null) {
            const curNonCantrips = prepared.filter(pid => {
              const s = _spells.find(s=>s.id===pid); return s && s.level > 0;
            }).length;
            if (curNonCantrips >= maxPrep) {
              chk.checked = false;
              Toast.show(`Limite de magias preparadas: ${maxPrep}`); return;
            }
          }
          CharacterState.prepareSpell(id);
        } else { CharacterState.unprepareSpell(id); }
        const entry = document.getElementById(`spell-${id}`);
        if (entry) entry.classList.toggle('prepared', chk.checked);
        _refreshActiveSidePanel(el);
      });
    });

    el.querySelectorAll('[data-spell-toggle]').forEach(btn => {
      btn.addEventListener('click', () => {
        const entry = document.getElementById(`spell-${btn.dataset.spellToggle}`);
        if (entry) {
          const expanded = entry.classList.toggle('expanded');
          btn.textContent = expanded ? '▾ Ocultar' : '▸ Detalhes';
        }
      });
    });
  };

  const _refreshActiveSidePanel = (el) => {
    const prepared = CharacterState.get().spells?.prepared || [];
    const listEl   = document.getElementById('active-spells-list');
    const titleEl  = document.getElementById('active-spells-title');
    if (listEl) {
      listEl.innerHTML = prepared.length === 0
        ? `<div class="spells-empty">Nenhuma magia preparada.</div>`
        : prepared.map(id => {
            const s = _spells.find(sp => sp.id === id);
            return s ? `<div class="active-spell-item">
              <span class="active-spell-name">${s.name}</span>
              <span class="active-spell-level">${SPELL_LVL_LABELS[s.level]||'Truque'}</span>
            </div>` : '';
          }).join('');
    }
    if (titleEl) titleEl.textContent = `✦ Preparadas (${prepared.length})`;
  };

  return { init };
})();
