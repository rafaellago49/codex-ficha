/**
 * sheet.js — Main Character Sheet Renderer v5
 * Grimório refatorado: fluxos distintos por subtipo de conjurador.
 *   'prepared-list'  → Clérigo, Druida
 *   'prepared-half'  → Paladino, Patrulheiro
 *   'known-fixed'    → Bardo, Feiticeiro, Bruxo
 *   'grimoire'       → Mago (duas etapas: grimório → preparar)
 *   'none'           → sem magia
 */

import {
  CharacterState, DataLoader, Toast, fmt,
  CASTER_TYPE, CASTER_SUBTYPE, CASTING_ATTR,
  getMaxPrepared, getMaxSpellLevel,
  HIT_DIE_BY_CLASS
} from './app.js';
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
  { id:'acrobatics',      label:'Acrobacia',         attr:'dex' },
  { id:'animal-handling', label:'Lidar c/ Animais',  attr:'wis' },
  { id:'arcana',          label:'Arcanismo',          attr:'int' },
  { id:'athletics',       label:'Atletismo',          attr:'str' },
  { id:'deception',       label:'Enganação',          attr:'cha' },
  { id:'history',         label:'História',           attr:'int' },
  { id:'insight',         label:'Intuição',           attr:'wis' },
  { id:'intimidation',    label:'Intimidação',        attr:'cha' },
  { id:'investigation',   label:'Investigação',       attr:'int' },
  { id:'medicine',        label:'Medicina',           attr:'wis' },
  { id:'nature',          label:'Natureza',           attr:'int' },
  { id:'perception',      label:'Percepção',          attr:'wis' },
  { id:'performance',     label:'Atuação',            attr:'cha' },
  { id:'persuasion',      label:'Persuasão',          attr:'cha' },
  { id:'religion',        label:'Religião',           attr:'int' },
  { id:'sleight-of-hand', label:'Prestidigitação',    attr:'dex' },
  { id:'stealth',         label:'Furtividade',        attr:'dex' },
  { id:'survival',        label:'Sobrevivência',      attr:'wis' }
];

const SPELL_LVL_LABELS = {
  0:'Truques', 1:'1º Círculo', 2:'2º Círculo', 3:'3º Círculo', 4:'4º Círculo',
  5:'5º Círculo', 6:'6º Círculo', 7:'7º Círculo', 8:'8º Círculo', 9:'9º Círculo'
};

// Mapa interno: classId → nome PT-BR como aparece em spells.json
const CLASS_NAME_PT = {
  barbarian:'Bárbaro', bard:'Bardo', cleric:'Clérigo', druid:'Druida',
  fighter:'Guerreiro', monk:'Monge', paladin:'Paladino', ranger:'Patrulheiro',
  rogue:'Ladino', sorcerer:'Feiticeiro', warlock:'Bruxo', wizard:'Mago'
};

export const Sheet = (() => {
  let _viewEl      = null;
  let _activeTab   = 'registro';
  let _spells      = [];           // todos os spells do JSON
  let _spellFilter = 'all';
  let _grimoireTab = 'grimoire';   // sub-aba do Mago: 'grimoire' | 'prepared'
  let _alwaysPrepared = [];        // IDs das magias "Sempre Preparadas" da subclasse

  // ── Public ────────────────────────────────────────────────────────────────
  const init = async (viewEl) => {
    _viewEl = viewEl;
    _spells = await DataLoader.load('./data/spells.json') || [];
    // Pré-carrega magias sempre preparadas da subclasse
    _alwaysPrepared = await CharacterState.getAlwaysPreparedSpells();
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
        if (_activeTab === target) return;
        _activeTab = target;
        _viewEl.querySelectorAll('.sheet-tab').forEach(b => b.classList.remove('active'));
        _viewEl.querySelectorAll('.sheet-panel').forEach(p => {
          p.classList.remove('active');
          p.innerHTML = '';
        });
        btn.classList.add('active');
        const panel = document.getElementById(`panel-${_activeTab}`);
        if (panel) { panel.classList.add('active'); _renderActivePanel(); }
      });
    });
  };

  // ── Topbar ─────────────────────────────────────────────────────────────────
  const _attachTopbar = () => {
    document.getElementById('btn-home-back')?.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('navigate-home'));
    });

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
      // Clérigos/Druidas/Paladinos: limpa prepared para nova seleção
      const subtype = CASTER_SUBTYPE[state.identity?.classId];
      if (subtype === 'prepared-list' || subtype === 'prepared-half' || subtype === 'grimoire') {
        const ap = _alwaysPrepared;
        const freshState = CharacterState.get();
        CharacterState.patch({ spells: { ...freshState.spells, prepared: [...ap] } });
      }
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

      document.getElementById('short-rest-modal-overlay')?.remove();

      const overlay = document.createElement('div');
      overlay.id = 'short-rest-modal-overlay';
      overlay.className = 'modal-overlay';
      overlay.innerHTML = `
        <div class="modal-box" style="max-width:360px" role="dialog" aria-modal="true">
          <div class="modal-header">
            <div class="modal-title">⛺ Descanso Curto</div>
            <button class="modal-close-btn" id="sr-modal-close" title="Cancelar">✕</button>
          </div>
          <div class="modal-body" style="text-align:center">
            <p style="margin-bottom:0.75rem;color:var(--text-muted)">
              Dados de Vida disponíveis: <strong id="sr-avail-display">${available}</strong> / ${level}
            </p>
            <p style="margin-bottom:1rem;font-size:0.85rem;color:var(--text-dim)">
              Cada dado: 1d${sides} ${conTxt} PV
            </p>
            ${isWarlock ? `<p style="margin-bottom:1rem;color:var(--gold);font-size:0.85rem">✦ Warlock recupera todos os Spell Slots de Pacto.</p>` : ''}
            <div class="dice-hybrid-tabs" style="margin-bottom:0.75rem">
              <button class="dice-tab-btn active" data-sr-mode="virtual">🎲 Virtual</button>
              <button class="dice-tab-btn" data-sr-mode="manual">✍ Físico</button>
            </div>
            <div id="sr-virtual-panel" style="display:flex;gap:0.5rem;justify-content:center;margin-bottom:1rem">
              <button class="btn btn-secondary btn-sm" id="sr-use-dice">🎲 Usar 1 Dado de Vida (1d${sides})</button>
            </div>
            <div id="sr-manual-panel" style="display:none;margin-bottom:1rem">
              <div style="display:flex;align-items:center;gap:0.5rem;justify-content:center;margin-bottom:0.4rem">
                <input type="number" id="sr-manual-input" class="form-control"
                  style="width:80px;text-align:center;font-size:1.2rem;font-family:var(--font-heading)"
                  placeholder="—" min="1" max="${sides}">
                <button class="btn btn-secondary btn-sm" id="sr-manual-confirm">✔ Confirmar</button>
              </div>
              <div style="font-size:0.72rem;color:var(--text-dim)">
                Role seu d${sides} físico e insira o resultado (1–${sides})
              </div>
            </div>
            <div id="sr-result" style="font-size:1.5rem;font-weight:700;color:var(--gold);min-height:2rem"></div>
            <div id="sr-rolls-log" style="font-size:0.78rem;color:var(--text-dim);margin-top:0.4rem"></div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary btn-sm" id="sr-cancel">Cancelar</button>
            <button class="btn btn-primary btn-sm" id="sr-confirm">Confirmar Descanso</button>
          </div>
        </div>`;
      document.body.appendChild(overlay);
      overlay.classList.add('open');

      // ── State local — dados só são gastos ao confirmar ──────────────────
      let totalHeal  = 0;
      let diceUsed   = 0;
      let availLocal = available;  // rastreia disponibilidade sem tocar no estado global

      const rollsLog = [];

      const _updateDisplay = () => {
        document.getElementById('sr-avail-display').textContent = availLocal;
        document.getElementById('sr-result').textContent =
          totalHeal > 0 ? `+${totalHeal} PV (${diceUsed} dado${diceUsed > 1 ? 's' : ''})` : '';
        document.getElementById('sr-rolls-log').innerHTML =
          rollsLog.map(r => `<span style="color:var(--text-dim)">${r}</span>`).join(' · ');
        document.getElementById('sr-use-dice').disabled = availLocal <= 0;
      };

      const _closeAndCancel = () => {
        // Fecha sem salvar nada — estado global não foi tocado
        overlay.remove();
      };

      overlay.querySelector('#sr-use-dice')?.addEventListener('click', () => {
        if (availLocal <= 0) { Toast.show('Sem dados de vida restantes.'); return; }
        const roll = Math.floor(Math.random() * sides) + 1;
        const heal = Math.max(1, roll + conMod);
        totalHeal += heal;
        diceUsed++;
        availLocal--;
        rollsLog.push(`d${sides}=${roll}${conMod !== 0 ? (conMod > 0 ? `+${conMod}` : conMod) : ''}→${heal}`);
        _updateDisplay();
      });

      // Mode tabs
      let srMode = 'virtual';
      const _setSRMode = (mode) => {
        srMode = mode;
        overlay.querySelectorAll('[data-sr-mode]').forEach(b =>
          b.classList.toggle('active', b.dataset.srMode === mode));
        overlay.querySelector('#sr-virtual-panel').style.display = mode === 'virtual' ? 'flex' : 'none';
        overlay.querySelector('#sr-manual-panel').style.display  = mode === 'manual'  ? 'block' : 'none';
        if (mode === 'manual') {
          const inp = overlay.querySelector('#sr-manual-input');
          if (inp) { inp.value = ''; inp.focus(); }
        }
      };
      overlay.querySelectorAll('[data-sr-mode]').forEach(btn => {
        btn.addEventListener('click', () => _setSRMode(btn.dataset.srMode));
      });

      // Manual confirm
      const _confirmManual = () => {
        if (availLocal <= 0) { Toast.show('Sem dados de vida restantes.'); return; }
        const inp = overlay.querySelector('#sr-manual-input');
        const roll = parseInt(inp?.value);
        if (!roll || roll < 1 || roll > sides) {
          Toast.show(`⚠ Insira um valor válido (1–${sides})`); return;
        }
        const heal = Math.max(1, roll + conMod);
        totalHeal += heal;
        diceUsed++;
        availLocal--;
        rollsLog.push(`d${sides}=${roll}${conMod !== 0 ? (conMod > 0 ? `+${conMod}` : conMod) : ''}→${heal} (Físico)`);
        if (inp) inp.value = '';
        _updateDisplay();
      };
      overlay.querySelector('#sr-manual-confirm')?.addEventListener('click', _confirmManual);
      overlay.querySelector('#sr-manual-input')?.addEventListener('keydown', e => {
        if (e.key === 'Enter') _confirmManual();
      });

      overlay.querySelector('#sr-confirm')?.addEventListener('click', () => {
        const cur = CharacterState.get();
        // Gasta os dados de vida usados
        if (diceUsed > 0) {
          const newUsed = (cur.combat?.hitDiceUsed || 0) + diceUsed;
          const newHp   = Math.min(cur.combat.hp.current + totalHeal, cur.combat.hp.max);
          CharacterState.patch({
            combat: {
              ...cur.combat,
              hitDiceUsed: newUsed,
              hp: { ...cur.combat.hp, current: newHp }
            }
          });
          Toast.show(`⛺ Descanso Curto: +${totalHeal} PV recuperados (${diceUsed} dado${diceUsed > 1 ? 's' : ''} gastos).`);
        } else if (!isWarlock) {
          Toast.show('⛺ Descanso Curto concluído (nenhum dado usado).');
        }
        if (isWarlock) {
          CharacterState.resetPactSlots();
          Toast.show('✦ Slots de Pacto recuperados.');
        }
        overlay.remove();
        _renderActivePanel();
      });

      // Botão Cancelar e X: descartam sem salvar
      overlay.querySelector('#sr-cancel')?.addEventListener('click', _closeAndCancel);
      overlay.querySelector('#sr-modal-close')?.addEventListener('click', _closeAndCancel);
      overlay.addEventListener('click', e => { if (e.target === overlay) _closeAndCancel(); });
    });
  };

  // ══════════════════════════════════════════════════════════════════════════
  // PANEL 1 — REGISTRO (mantido idêntico ao original; omitido por brevidade)
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
          ${_htmlPreparedSpellsBlock()}
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
          <span class="slot-lbl">${SPELL_LVL_LABELS[+lvl]||lvl+'º'}</span>
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

  // ── Magias Preparadas/Conhecidas (Registro) ───────────────────────────────
  const _htmlPreparedSpellsBlock = () => {
    const state   = CharacterState.get();
    const classId = state.identity?.classId || '';
    const subtype = CASTER_SUBTYPE[classId] || 'none';
    if (subtype === 'none') return '';

    const slots   = state.spells?.slots || {};
    if (Object.keys(slots).length === 0) return '';

    const known    = state.spells?.known    || [];
    const prepared = state.spells?.prepared || [];

    // Decide which list to show and its label
    let spellIds = [];
    let blockLabel = '';
    if (subtype === 'known-fixed') {
      spellIds   = known;
      blockLabel = '📖 Magias Conhecidas';
    } else {
      // prepared-list, prepared-half, grimoire — show prepared
      spellIds   = prepared;
      blockLabel = '✦ Magias Preparadas';
    }

    if (spellIds.length === 0) return `
      <div class="card mb-2">
        <div class="card-title">${blockLabel}</div>
        <p style="font-size:0.82rem;color:var(--text-dim);font-style:italic">
          Nenhuma magia ${subtype === 'known-fixed' ? 'conhecida' : 'preparada'} ainda.
          Acesse a aba Grimório para selecionar.
        </p>
      </div>`;

    // Group by level — we need _spells but they're scoped to Sheet closure above
    const grouped = {};
    for (const id of spellIds) {
      const sp = _spells.find(s => s.id === id);
      if (!sp) continue;
      const lvl = sp.level ?? 0;
      if (!grouped[lvl]) grouped[lvl] = [];
      grouped[lvl].push(sp);
    }
    const rows = Object.keys(grouped).sort((a,b)=>+a-+b).map(lvl => {
      const label = SPELL_LVL_LABELS[+lvl] || `${lvl}º Círculo`;
      const spells = grouped[lvl].map(sp => `
        <div style="display:flex;align-items:baseline;gap:0.4rem;padding:0.15rem 0;border-bottom:1px solid var(--border-faint)">
          <span style="font-size:0.82rem;color:var(--text-primary)">${sp.name}</span>
          ${sp.school ? `<span style="font-size:0.68rem;color:var(--text-dim)">(${sp.school})</span>` : ''}
          ${sp.ritual ? `<span style="font-size:0.65rem;color:var(--gold-dim)">ritual</span>` : ''}
        </div>`).join('');
      return `
        <div style="margin-bottom:0.5rem">
          <div style="font-size:0.68rem;font-family:var(--font-heading);text-transform:uppercase;letter-spacing:1.2px;color:var(--text-dim);margin-bottom:0.2rem">${label}</div>
          ${spells}
        </div>`;
    }).join('');

    return `
      <div class="card mb-2">
        <div class="card-title">${blockLabel} <span style="font-size:0.75rem;color:var(--text-muted);font-family:inherit;font-weight:normal">(${spellIds.length})</span></div>
        ${rows}
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
  // PANEL 3 — GRIMÓRIO (completamente refatorado)
  // ══════════════════════════════════════════════════════════════════════════
  const _renderGrimorio = () => {
    const el = document.getElementById('panel-grimorio');
    if (!el) return;

    const state    = CharacterState.get();
    const classId  = state.identity?.classId || '';
    const subtype  = CASTER_SUBTYPE[classId] || 'none';

    // Classe sem conjuração
    if (subtype === 'none') {
      el.innerHTML = `
        <div class="grimoire-empty">
          <div style="font-size:2.5rem;margin-bottom:0.75rem">📚</div>
          <div style="font-size:1rem;color:var(--text-muted)">
            ${CLASS_NAME_PT[classId] || 'Esta classe'} não possui conjuração de magias.
          </div>
        </div>`;
      return;
    }

    // Despacha para o renderizador correto
    switch (subtype) {
      case 'prepared-list':
      case 'prepared-half':
        _renderGrimorioPreparado(el, state, classId, subtype);
        break;
      case 'known-fixed':
        _renderGrimorioKnownFixed(el, state, classId);
        break;
      case 'grimoire':
        _renderGrimorioMago(el, state);
        break;
    }
  };

  // ── Helpers compartilhados ──────────────────────────────────────────────

  /**
   * Retorna magias da classe filtradas pelo nível máximo de slot disponível.
   * Truques (nível 0) sempre são incluídos.
   */
  const _getClassSpells = (classId, level) => {
    const className  = CLASS_NAME_PT[classId] || '';
    const maxSl      = getMaxSpellLevel(classId, level);
    return _spells.filter(s =>
      s.classes?.includes(className) &&
      (s.level === 0 || s.level <= maxSl)
    );
  };

  /** Renderiza um grupo de magias por nível */
  const _spellGroupHtml = (spells, { checkboxAttr, checkedFn, disabledFn, badgeFn } = {}) => {
    const grouped = {};
    spells.forEach(s => { if (!grouped[s.level]) grouped[s.level]=[]; grouped[s.level].push(s); });

    return Object.entries(grouped).sort((a,b) => +a[0]-+b[0]).map(([lvl, list]) => {
      const items = list.map(s => {
        const checked  = checkedFn ? checkedFn(s) : false;
        const disabled = disabledFn ? disabledFn(s) : false;
        const badge    = badgeFn   ? badgeFn(s)    : '';
        return `
          <div class="spell-entry ${checked?'prepared':''}" id="spell-${s.id}">
            <input type="checkbox" class="spell-checkbox"
              data-spell-id="${s.id}" data-spell-level="${s.level}"
              ${checkboxAttr||''}
              ${checked ? 'checked' : ''}
              ${disabled ? 'disabled title="Sempre Preparada"' : ''}>
            <div class="spell-info">
              <div class="spell-name">
                ${s.name}
                ${badge}
              </div>
              <div class="spell-meta">
                <span class="badge badge-gold">${SPELL_LVL_LABELS[s.level]||'Truque'}</span>
                <span class="badge badge-arcane">${s.school}</span>
                <span style="font-size:0.78rem;color:var(--text-dim)">${s.castingTime}</span>
                <span style="font-size:0.78rem;color:var(--text-dim)">${s.range}</span>
              </div>
              <div class="spell-desc-text">${s.description}</div>
              <div class="spell-components" style="font-size:0.76rem;color:var(--text-dim);margin-top:0.2rem">
                ${s.components} · ${s.duration}
              </div>
              <button class="spell-toggle" data-spell-toggle="${s.id}">▸ Detalhes</button>
            </div>
          </div>`;
      }).join('');

      return `
        <div class="spell-group" style="margin-bottom:1.25rem">
          <div class="spell-group-header">
            ${SPELL_LVL_LABELS[lvl]||'Nível '+lvl}
          </div>
          ${items}
        </div>`;
    }).join('');
  };

  /** Renderiza o painel lateral de preparadas/conhecidas */
  const _activePanelHtml = (spellIds, title) => {
    const items = spellIds.length === 0
      ? `<div class="spells-empty">Nenhuma magia.</div>`
      : spellIds.map(id => {
          const s = _spells.find(sp => sp.id === id);
          if (!s) return '';
          const isAP = _alwaysPrepared.includes(id);
          return `<div class="active-spell-item ${isAP?'always-prepared':''}">
            <span class="active-spell-name">${s.name}</span>
            <span class="active-spell-level">${SPELL_LVL_LABELS[s.level]||'Truque'}</span>
            ${isAP ? `<span class="badge badge-gold" title="Sempre Preparada" style="font-size:0.65rem">✦</span>` : ''}
          </div>`;
        }).join('');
    return { title: `${title} (${spellIds.length})`, items };
  };

  /** Filtro de nível de magia */
  const _filterBarHtml = (available, current) => {
    const opts = [
      `<option value="all" ${current==='all'?'selected':''}>Todos os círculos</option>`,
      ...available.map(l =>
        `<option value="${l}" ${current==l?'selected':''}>${SPELL_LVL_LABELS[l]||'Nível '+l}</option>`)
    ].join('');
    return `<select class="filter-select" id="spell-level-filter">${opts}</select>`;
  };

  /** Aplica eventos comuns (toggle de detalhes, filtro de nível) */
  const _attachCommonEvents = (el) => {
    el.querySelectorAll('[data-spell-toggle]').forEach(btn => {
      btn.addEventListener('click', () => {
        const entry = document.getElementById(`spell-${btn.dataset.spellToggle}`);
        if (entry) {
          const expanded = entry.classList.toggle('expanded');
          btn.textContent = expanded ? '▾ Ocultar' : '▸ Detalhes';
        }
      });
    });
    el.querySelector('#spell-level-filter')?.addEventListener('change', e => {
      _spellFilter = e.target.value; _renderGrimorio();
    });
  };

  // ──────────────────────────────────────────────────────────────────────────
  // FLUXO A: Clérigo, Druida, Paladino — Preparação diária da lista da classe
  // ──────────────────────────────────────────────────────────────────────────
  const _renderGrimorioPreparado = (el, state, classId, subtype) => {
    const level    = state.identity?.level || 1;
    const castAttr = CASTING_ATTR[classId] || 'wis';
    const castMod  = CharacterState.getModifier(castAttr);
    const { max: maxPrep } = getMaxPrepared(classId, level, castMod);

    // Meio-conjuradores só começam a conjurar a partir do nível 2 (Paladino e Patrulheiro)
    if (subtype === 'prepared-half' && level < 2) {
      el.innerHTML = `
        <div class="grimoire-empty">
          <div style="font-size:2rem;margin-bottom:0.75rem">🔒</div>
          <div style="font-size:1rem;color:var(--text-muted)">
            ${CLASS_NAME_PT[classId]} começa a conjurar magias a partir do <strong>nível 2</strong>.
          </div>
          <div style="font-size:0.85rem;color:var(--text-dim);margin-top:0.5rem">
            Suba de nível para desbloquear o grimório.
          </div>
        </div>`;
      return;
    }

    // Lista de magias acessíveis (todos os círculos até o máximo de slots)
    let classSpells = _getClassSpells(classId, level);

    // Injeta magias "sempre preparadas" da subclasse (não saem do prepared)
    _alwaysPrepared.forEach(id => {
      if (!state.spells.prepared.includes(id)) {
        CharacterState.prepareSpell(id);
      }
    });

    const prepared = CharacterState.get().spells?.prepared || [];

    // Filtro
    const levels  = [...new Set(classSpells.map(s => s.level))].sort((a,b) => a-b);
    const filtered = _spellFilter === 'all' ? classSpells
      : classSpells.filter(s => s.level === parseInt(_spellFilter));

    const preparedNonCantrips = prepared.filter(id => {
      const s = _spells.find(sp => sp.id === id);
      return s && s.level > 0;
    }).length;

    const prepInfo = `
      <div class="prep-info-bar">
        <span>Preparadas hoje:</span>
        <strong style="color:${preparedNonCantrips > maxPrep ? 'var(--crimson-bright)' : 'var(--gold-bright)'}">
          ${preparedNonCantrips}</strong>
        <span>/ ${maxPrep}</span>
        <span style="color:var(--text-dim);margin-left:0.5rem;font-size:0.8rem">
          (${CLASS_NAME_PT[classId]} · nível ${level} + mod. ${castAttr.toUpperCase()} ${castMod >= 0 ? '+'+castMod : castMod})
        </span>
      </div>`;

    const spellListHtml = _spellGroupHtml(filtered, {
      checkedFn:  s => prepared.includes(s.id),
      disabledFn: s => _alwaysPrepared.includes(s.id),
      badgeFn:    s => _alwaysPrepared.includes(s.id)
        ? `<span class="badge badge-gold" style="font-size:0.65rem;margin-left:0.4rem" title="Sempre Preparada">✦ Sempre</span>`
        : ''
    });

    const { title: activeTitle, items: activeItems } = _activePanelHtml(prepared, '✦ Preparadas');

    el.innerHTML = `
      <div class="grimoire-layout">
        <div class="grimoire-main">
          ${prepInfo}
          <div class="spell-filters">
            <span class="filter-label">Filtrar:</span>
            ${_filterBarHtml(levels, _spellFilter)}
            <span style="font-size:0.82rem;color:var(--text-muted)">${classSpells.length} magias disponíveis</span>
          </div>
          <div id="spell-list-container">${spellListHtml}</div>
        </div>
        <div class="active-spells-panel">
          <div class="card" style="position:sticky;top:1rem">
            <div class="card-title" id="active-spells-title">${activeTitle}</div>
            <div id="active-spells-list">${activeItems}</div>
          </div>
        </div>
      </div>`;

    _attachCommonEvents(el);

    el.querySelectorAll('.spell-checkbox').forEach(chk => {
      chk.addEventListener('change', () => {
        const id = chk.dataset.spellId;
        const sp = _spells.find(s => s.id === id);
        if (!sp) return;

        if (chk.checked) {
          // Truques não contam no limite
          if (sp.level > 0) {
            const curPrep = CharacterState.get().spells?.prepared || [];
            const curNonCantrips = curPrep.filter(pid => {
              const s = _spells.find(s => s.id === pid); return s && s.level > 0;
            }).length;
            if (curNonCantrips >= maxPrep) {
              chk.checked = false;
              Toast.show(`⚔ Limite de ${maxPrep} magia${maxPrep!==1?'s':''} preparada${maxPrep!==1?'s':''}.`);
              return;
            }
          }
          CharacterState.prepareSpell(id);
        } else {
          // Impede remoção de magias sempre preparadas
          if (_alwaysPrepared.includes(id)) {
            chk.checked = true;
            Toast.show('✦ Esta magia é sempre preparada pela sua subclasse.');
            return;
          }
          CharacterState.unprepareSpell(id);
        }

        document.getElementById(`spell-${id}`)?.classList.toggle('prepared', chk.checked);
        _refreshSidePanel(el, '✦ Preparadas');
      });
    });
  };

  // ──────────────────────────────────────────────────────────────────────────
  // FLUXO B: Bardo, Feiticeiro, Bruxo — Magias Conhecidas (lista fixa)
  // Patrulheiro também usa este fluxo (tabela de known do PHB)
  // ──────────────────────────────────────────────────────────────────────────
  const _renderGrimorioKnownFixed = (el, state, classId) => {
    const level    = state.identity?.level || 1;
    const castAttr = CASTING_ATTR[classId] || 'cha';
    const castMod  = CharacterState.getModifier(castAttr);
    const { max: maxKnown } = getMaxPrepared(classId, level, castMod);

    // Para classes "known-fixed" o Patrulheiro não tem truques; os outros têm
    let classSpells = _getClassSpells(classId, level);

    const known   = state.spells?.known    || [];
    const prepared = state.spells?.prepared || [];

    const levels  = [...new Set(classSpells.map(s => s.level))].sort((a,b) => a-b);
    const filtered = _spellFilter === 'all' ? classSpells
      : classSpells.filter(s => s.level === parseInt(_spellFilter));

    const knownNonCantrips = known.filter(id => {
      const s = _spells.find(sp => sp.id === id); return s && s.level > 0;
    }).length;

    const canLearnMore = knownNonCantrips < maxKnown;
    const isRanger     = classId === 'ranger';

    const infoBar = `
      <div class="prep-info-bar">
        <span>Magias conhecidas:</span>
        <strong style="color:${knownNonCantrips > maxKnown ? 'var(--crimson-bright)' : 'var(--gold-bright)'}">
          ${knownNonCantrips}</strong>
        <span>/ ${maxKnown}</span>
        <span style="font-size:0.78rem;color:var(--text-dim);margin-left:0.5rem">
          · A lista muda apenas ao subir de nível.
        </span>
      </div>`;

    const spellListHtml = _spellGroupHtml(filtered, {
      checkedFn:  s => known.includes(s.id),
      disabledFn: s => {
        // Desabilita adição se limite atingido E a magia não está conhecida
        if (s.level === 0) return false; // truques: sem limite aqui
        return !known.includes(s.id) && !canLearnMore;
      },
      badgeFn: s => known.includes(s.id)
        ? `<span style="font-size:0.65rem;color:var(--gold-dim);margin-left:4px">✔ Conhecida</span>`
        : (!canLearnMore && s.level > 0 ? `<span style="font-size:0.65rem;color:var(--text-dim);margin-left:4px">Limite</span>` : '')
    });

    const { title: activeTitle, items: activeItems } = _activePanelHtml(known, '📖 Conhecidas');

    el.innerHTML = `
      <div class="grimoire-layout">
        <div class="grimoire-main">
          <div class="grimoire-mode-banner">
            <span style="font-size:0.85rem;color:var(--text-muted)">
              🔒 Magias conhecidas são permanentes e só mudam ao ganhar um nível.
              ${isRanger ? 'Patrulheiros não possuem truques.' : ''}
            </span>
          </div>
          ${infoBar}
          <div class="spell-filters">
            <span class="filter-label">Filtrar:</span>
            ${_filterBarHtml(levels, _spellFilter)}
            <span style="font-size:0.82rem;color:var(--text-muted)">${classSpells.length} magias disponíveis</span>
          </div>
          <div id="spell-list-container">${spellListHtml}</div>
        </div>
        <div class="active-spells-panel">
          <div class="card" style="position:sticky;top:1rem">
            <div class="card-title" id="active-spells-title">${activeTitle}</div>
            <div id="active-spells-list">${activeItems}</div>
          </div>
        </div>
      </div>`;

    _attachCommonEvents(el);

    el.querySelectorAll('.spell-checkbox').forEach(chk => {
      chk.addEventListener('change', () => {
        const id = chk.dataset.spellId;
        const sp = _spells.find(s => s.id === id);
        if (!sp) return;

        if (chk.checked) {
          // Truques não contam no limite de known (classes fixas têm tabela separada)
          if (sp.level > 0) {
            const curKnown = CharacterState.get().spells?.known || [];
            const curNonCantrips = curKnown.filter(pid => {
              const s = _spells.find(s => s.id === pid); return s && s.level > 0;
            }).length;
            if (curNonCantrips >= maxKnown) {
              chk.checked = false;
              Toast.show(`📖 Limite de ${maxKnown} magia${maxKnown!==1?'s':''} conhecida${maxKnown!==1?'s':''}.`);
              return;
            }
          }
          CharacterState.learnSpell(id);
        } else {
          CharacterState.forgetSpell(id);
        }

        document.getElementById(`spell-${id}`)?.classList.toggle('prepared', chk.checked);
        _refreshSidePanel(el, '📖 Conhecidas', true);
      });
    });
  };

  // ──────────────────────────────────────────────────────────────────────────
  // FLUXO C: Mago — Grimório (duas etapas)
  //  Sub-aba "grimorio" → adiciona ao grimório físico (known)
  //  Sub-aba "prepared" → seleciona do grimório para preparo diário
  // ──────────────────────────────────────────────────────────────────────────
  const _renderGrimorioMago = (el, state) => {
    const classId  = 'wizard';
    const level    = state.identity?.level || 1;
    const castMod  = CharacterState.getModifier('int');
    const { max: maxPrep } = getMaxPrepared(classId, level, castMod);

    const known   = state.spells?.known    || [];
    const prepared = state.spells?.prepared || [];

    // Sub-tabs do Mago
    el.innerHTML = `
      <div class="grimoire-wizard-tabs">
        <button class="grimoire-subtab ${_grimoireTab==='grimoire'?'active':''}"
          data-subtab="grimoire">📜 Grimório (${known.length})</button>
        <button class="grimoire-subtab ${_grimoireTab==='prepared'?'active':''}"
          data-subtab="prepared">✦ Preparar (${prepared.filter(id=>{ const s=_spells.find(s=>s.id===id);return s&&s.level>0; }).length}/${maxPrep})</button>
      </div>
      <div id="wizard-subtab-content"></div>`;

    el.querySelectorAll('.grimoire-subtab').forEach(btn => {
      btn.addEventListener('click', () => {
        _grimoireTab = btn.dataset.subtab;
        el.querySelectorAll('.grimoire-subtab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        _renderWizardSubtab(document.getElementById('wizard-subtab-content'), state, known, prepared, maxPrep, level, castMod);
      });
    });

    _renderWizardSubtab(
      document.getElementById('wizard-subtab-content'),
      state, known, prepared, maxPrep, level, castMod
    );
  };

  const _renderWizardSubtab = (el, state, known, prepared, maxPrep, level, castMod) => {
    if (!el) return;

    if (_grimoireTab === 'grimoire') {
      _renderWizardGrimoire(el, known, level);
    } else {
      _renderWizardPrepared(el, known, prepared, maxPrep, level);
    }
  };

  /** Sub-aba A do Mago: adiciona/remove magias do grimório físico */
  const _renderWizardGrimoire = (el, known, level) => {
    const classId    = 'wizard';
    const allWizard  = _getClassSpells(classId, level);
    const levels     = [...new Set(allWizard.map(s => s.level))].sort((a,b) => a-b);
    const filtered   = _spellFilter === 'all' ? allWizard
      : allWizard.filter(s => s.level === parseInt(_spellFilter));

    const spellListHtml = _spellGroupHtml(filtered, {
      checkedFn: s => known.includes(s.id),
      badgeFn:   s => known.includes(s.id)
        ? `<span style="font-size:0.65rem;color:var(--gold-dim);margin-left:4px">✔ No grimório</span>`
        : ''
    });

    el.innerHTML = `
      <div style="padding:0.5rem 0 0.75rem">
        <div style="font-size:0.83rem;color:var(--text-muted);margin-bottom:0.5rem">
          📜 Adicione magias ao seu grimório físico. Magias no grimório podem ser
          preparadas diariamente. Marque para transcrever, desmarque para apagar.
        </div>
        <div style="font-size:0.83rem;color:var(--gold-dim)">
          Magias no grimório: <strong>${known.filter(id=>{ const s=_spells.find(s=>s.id===id);return s&&s.level>0; }).length}</strong>
          (truques: ${known.filter(id=>{ const s=_spells.find(s=>s.id===id);return s&&s.level===0; }).length})
        </div>
      </div>
      <div class="spell-filters">
        <span class="filter-label">Filtrar:</span>
        ${_filterBarHtml(levels, _spellFilter)}
        <span style="font-size:0.82rem;color:var(--text-muted)">${allWizard.length} magias de Mago</span>
      </div>
      <div id="spell-list-container">${spellListHtml}</div>`;

    el.querySelector('#spell-level-filter')?.addEventListener('change', e => {
      _spellFilter = e.target.value;
      _renderGrimorio();
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

    el.querySelectorAll('.spell-checkbox').forEach(chk => {
      chk.addEventListener('change', () => {
        const id = chk.dataset.spellId;
        if (chk.checked) {
          CharacterState.learnSpell(id);
          Toast.show('📜 Magia transcrita no grimório.');
        } else {
          // Aviso se a magia está preparada
          if (CharacterState.isSpellPrepared(id)) {
            if (!confirm('Esta magia está preparada hoje. Apagá-la do grimório também a removerá das preparadas. Continuar?')) {
              chk.checked = true; return;
            }
          }
          CharacterState.forgetSpell(id);
          Toast.show('🗑 Magia removida do grimório.');
        }
        document.getElementById(`spell-${id}`)?.classList.toggle('prepared', chk.checked);
        // Atualiza contador da sub-aba
        _renderGrimorio();
      });
    });
  };

  /** Sub-aba B do Mago: seleciona do grimório para o dia */
  const _renderWizardPrepared = (el, known, prepared, maxPrep, level) => {
    // Apenas magias que estão no grimório
    const grimmSpells = _spells.filter(s => known.includes(s.id));
    const levels      = [...new Set(grimmSpells.map(s => s.level))].sort((a,b) => a-b);
    const filtered    = _spellFilter === 'all' ? grimmSpells
      : grimmSpells.filter(s => s.level === parseInt(_spellFilter));

    const preparedNonCantrips = prepared.filter(id => {
      const s = _spells.find(sp => sp.id === id); return s && s.level > 0;
    }).length;

    const prepInfo = `
      <div class="prep-info-bar">
        <span>Preparadas hoje (do grimório):</span>
        <strong style="color:${preparedNonCantrips > maxPrep ? 'var(--crimson-bright)' : 'var(--gold-bright)'}">
          ${preparedNonCantrips}</strong>
        <span>/ ${maxPrep}</span>
        <span style="color:var(--text-dim);font-size:0.8rem;margin-left:0.4rem">
          (nível ${level} + INT ${CharacterState.getModifier('int') >= 0 ? '+' : ''}${CharacterState.getModifier('int')})
        </span>
      </div>`;

    if (grimmSpells.length === 0) {
      el.innerHTML = `
        ${prepInfo}
        <div class="grimoire-empty" style="margin-top:1rem">
          <div style="font-size:0.9rem;color:var(--text-muted)">
            Adicione magias ao grimório primeiro (aba "Grimório").
          </div>
        </div>`;
      return;
    }

    const spellListHtml = _spellGroupHtml(filtered, {
      checkedFn: s => prepared.includes(s.id),
    });

    const { title: activeTitle, items: activeItems } = _activePanelHtml(prepared, '✦ Preparadas');

    el.innerHTML = `
      <div class="grimoire-layout">
        <div class="grimoire-main">
          ${prepInfo}
          <div class="spell-filters">
            <span class="filter-label">Filtrar:</span>
            ${_filterBarHtml(levels, _spellFilter)}
            <span style="font-size:0.82rem;color:var(--text-muted)">
              ${grimmSpells.length} magias no grimório
            </span>
          </div>
          <div id="spell-list-container">${spellListHtml}</div>
        </div>
        <div class="active-spells-panel">
          <div class="card" style="position:sticky;top:1rem">
            <div class="card-title" id="active-spells-title">${activeTitle}</div>
            <div id="active-spells-list">${activeItems}</div>
          </div>
        </div>
      </div>`;

    el.querySelector('#spell-level-filter')?.addEventListener('change', e => {
      _spellFilter = e.target.value; _renderGrimorio();
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

    el.querySelectorAll('.spell-checkbox').forEach(chk => {
      chk.addEventListener('change', () => {
        const id = chk.dataset.spellId;
        const sp = _spells.find(s => s.id === id);
        if (!sp) return;

        if (chk.checked) {
          if (sp.level > 0) {
            const curPrep = CharacterState.get().spells?.prepared || [];
            const curNonCantrips = curPrep.filter(pid => {
              const s = _spells.find(s => s.id === pid); return s && s.level > 0;
            }).length;
            if (curNonCantrips >= maxPrep) {
              chk.checked = false;
              Toast.show(`✦ Limite de ${maxPrep} magia${maxPrep!==1?'s':''} preparada${maxPrep!==1?'s':''}.`);
              return;
            }
          }
          CharacterState.prepareSpell(id);
        } else {
          CharacterState.unprepareSpell(id);
        }

        document.getElementById(`spell-${id}`)?.classList.toggle('prepared', chk.checked);
        _refreshSidePanel(el, '✦ Preparadas');
      });
    });
  };

  // ── Atualização do painel lateral sem re-render completo ──────────────────
  const _refreshSidePanel = (el, title, useKnown = false) => {
    const state    = CharacterState.get();
    const ids      = useKnown
      ? (state.spells?.known    || [])
      : (state.spells?.prepared || []);
    const listEl   = document.getElementById('active-spells-list');
    const titleEl  = document.getElementById('active-spells-title');
    const { title: newTitle, items } = _activePanelHtml(ids, title);
    if (listEl)  listEl.innerHTML  = items;
    if (titleEl) titleEl.textContent = newTitle;
  };

  return { init };
})();