/**
 * sheet.js — Main Character Sheet Renderer
 * Handles tabs: Registro, Inventário, Grimório
 */

import { CharacterState, DataLoader, Toast, fmt } from './app.js';
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
  { id: 'acrobatics',     label: 'Acrobacia',        attr: 'dex' },
  { id: 'animal-handling',label: 'Lidar c/ Animais',  attr: 'wis' },
  { id: 'arcana',         label: 'Arcanismo',        attr: 'int' },
  { id: 'athletics',      label: 'Atletismo',        attr: 'str' },
  { id: 'deception',      label: 'Enganação',        attr: 'cha' },
  { id: 'history',        label: 'História',         attr: 'int' },
  { id: 'insight',        label: 'Intuição',         attr: 'wis' },
  { id: 'intimidation',   label: 'Intimidação',      attr: 'cha' },
  { id: 'investigation',  label: 'Investigação',     attr: 'int' },
  { id: 'medicine',       label: 'Medicina',         attr: 'wis' },
  { id: 'nature',         label: 'Natureza',         attr: 'int' },
  { id: 'perception',     label: 'Percepção',        attr: 'wis' },
  { id: 'performance',    label: 'Atuação',          attr: 'cha' },
  { id: 'persuasion',     label: 'Persuasão',        attr: 'cha' },
  { id: 'religion',       label: 'Religião',         attr: 'int' },
  { id: 'sleight-of-hand',label: 'Prestidigitação',  attr: 'dex' },
  { id: 'stealth',        label: 'Furtividade',      attr: 'dex' },
  { id: 'survival',       label: 'Sobrevivência',    attr: 'wis' }
];

const SPELL_LEVEL_LABELS = {
  0: 'Truques',
  1: '1º Nível', 2: '2º Nível', 3: '3º Nível',
  4: '4º Nível', 5: '5º Nível', 6: '6º Nível',
  7: '7º Nível', 8: '8º Nível', 9: '9º Nível'
};

export const Sheet = (() => {
  let _viewEl     = null;
  let _activeTab  = 'registro';
  let _spells     = [];
  let _classFeatures = null;
  let _spellFilter = 'all';

  // ── Public init ──────────────────────────────────────────────────────────
  const init = async (viewEl) => {
    _viewEl = viewEl;
    _spells = await DataLoader.load('./data/spells.json') || [];
    _classFeatures = await DataLoader.load('./data/class-features.json') || {};
    _render();
  };

  // ── Full view render ──────────────────────────────────────────────────────
  const _render = () => {
    const state = CharacterState.get();
    const id    = state.identity;
    const prof  = CharacterState.getProficiencyBonus();

    _viewEl.innerHTML = `
      <!-- TOP BAR -->
      <div class="sheet-topbar">
        <div class="topbar-left">
          <div>
            <div class="topbar-char-name">${id.name || 'Personagem'}</div>
            <div class="topbar-char-sub">
              ${id.race || ''}
              ${id.race && id.class ? ' · ' : ''}
              ${id.class || ''}
              ${id.level ? ` · Nível ${id.level}` : ''}
              ${prof ? ` · Proficiência +${prof}` : ''}
            </div>
          </div>
        </div>
        <div class="topbar-right">
          <button class="btn btn-secondary btn-sm" id="btn-level-up">⬆ Subir de Nível</button>
          <button class="btn btn-secondary btn-sm" id="btn-short-rest">☕ Descanso Curto</button>
          <button class="btn btn-secondary btn-sm" id="btn-long-rest">☾ Descanso Longo</button>
          <button class="btn btn-secondary btn-sm" id="btn-export">💾 Exportar</button>
          <button class="btn btn-ghost btn-sm" id="btn-home-back" title="Página inicial">⌂</button>
        </div>
      </div>

      <!-- TABS -->
      <div class="sheet-tabs">
        <button class="sheet-tab ${_activeTab === 'registro'   ? 'active' : ''}" data-tab="registro">Registro</button>
        <button class="sheet-tab ${_activeTab === 'inventario' ? 'active' : ''}" data-tab="inventario">Inventário</button>
        <button class="sheet-tab ${_activeTab === 'grimorio'   ? 'active' : ''}" data-tab="grimorio">Grimório</button>
      </div>

      <!-- BODY -->
      <div class="sheet-body">
        <div class="sheet-panel ${_activeTab === 'registro'   ? 'active' : ''}" id="panel-registro"></div>
        <div class="sheet-panel ${_activeTab === 'inventario' ? 'active' : ''}" id="panel-inventario"></div>
        <div class="sheet-panel ${_activeTab === 'grimorio'   ? 'active' : ''}" id="panel-grimorio"></div>
      </div>`;

    _attachTopbarListeners();
    _attachTabListeners();
    _renderActivePanel();
  };

  const _renderActivePanel = () => {
    switch (_activeTab) {
      case 'registro':   _renderRegistro();   break;
      case 'inventario': _renderInventario(); break;
      case 'grimorio':   _renderGrimorio();   break;
    }
  };

  // ── Tab switching ─────────────────────────────────────────────────────────
  const _attachTabListeners = () => {
    _viewEl.querySelectorAll('.sheet-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        _activeTab = btn.dataset.tab;
        _viewEl.querySelectorAll('.sheet-tab').forEach(b => b.classList.remove('active'));
        _viewEl.querySelectorAll('.sheet-panel').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(`panel-${_activeTab}`)?.classList.add('active');
        _renderActivePanel();
      });
    });
  };

  const _attachTopbarListeners = () => {
    document.getElementById('btn-export')?.addEventListener('click', () => {
      CharacterState.exportJSON();
      Toast.show('✦ Ficha exportada com sucesso.');
    });

    document.getElementById('btn-level-up')?.addEventListener('click', () => _handleLevelUp());
    document.getElementById('btn-short-rest')?.addEventListener('click', () => _handleShortRest());
    document.getElementById('btn-long-rest')?.addEventListener('click', () => {
      if (!confirm('Realizar Descanso Longo? HP e recursos serão restaurados.')) return;
      CharacterState.resetLongRest();
      Toast.show('☾ Descanso Longo realizado. Revigorado e renovado.');
      _renderActivePanel();
    });

    document.getElementById('btn-home-back')?.addEventListener('click', () => {
      if (confirm('Voltar à tela inicial? O progresso está salvo.')) {
        window.dispatchEvent(new CustomEvent('navigate-home'));
      }
    });
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // PANEL 1 — REGISTRO
  // ═══════════════════════════════════════════════════════════════════════════
  const _renderRegistro = () => {
    const el    = document.getElementById('panel-registro');
    if (!el) return;
    const state = CharacterState.get();

    el.innerHTML = `
      <div class="registro-grid">
        <!-- COL 1: Attributes + saves + skills -->
        <div>
          ${_renderAttrBlock()}
          ${_renderSavesBlock()}
          ${_renderSkillsBlock()}
          ${_renderProfBlock()}
        </div>

        <!-- COL 2: Combat + HP + Resources + Features -->
        <div>
          ${_renderCombatBlock()}
          ${_renderHPBlock()}
          ${_renderDeathSaves()}
          ${_renderResourcesBlock()}
          ${_renderFeaturesBlock()}
        </div>

        <!-- COL 3: Traits + Diary -->
        <div>
          ${_renderTraitsBlock()}
          ${_renderDiaryBlock()}
        </div>
      </div>`;

    _attachRegistroListeners(el);
  };

  const _renderAttrBlock = () => {
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
            <input type="text" class="form-control" id="sheet-inspiration" value="${CharacterState.get().combat?.inspiration || ''}" placeholder="—">
          </div>
          <div class="form-group" style="margin-bottom:0">
            <label>Proficiência</label>
            <input type="text" class="form-control" value="+${CharacterState.getProficiencyBonus()}" readonly>
          </div>
        </div>
      </div>`;
  };

  const _renderSavesBlock = () => {
    const proficient = CharacterState.get().savingThrows?.proficient || [];
    const items = ['str','dex','con','int','wis','cha'].map(k => {
      const mod = CharacterState.getSaveMod(k);
      const chk = proficient.includes(k);
      return `
        <div class="save-item">
          <input type="checkbox" data-save="${k}" ${chk ? 'checked' : ''} disabled>
          <span>${ATTR_LABELS[k].abbr}</span>
          <span style="color:var(--gold-dim);font-family:var(--font-heading);font-size:0.8rem">${fmt.modifier(mod)}</span>
        </div>`;
    }).join('');

    return `
      <div class="card mb-2">
        <div class="card-title">Salvaguardas</div>
        <div class="save-grid">${items}</div>
      </div>`;
  };

  const _renderSkillsBlock = () => {
    const proficient = CharacterState.get().skills?.proficient || [];
    const expertise  = CharacterState.get().skills?.expertise  || [];
    const rows = SKILLS.map(s => {
      const mod  = CharacterState.getSkillMod(s.id);
      const prof = proficient.includes(s.id);
      const exp  = expertise.includes(s.id);
      return `
        <div class="skill-row-item">
          <label class="skill-check">
            <input type="checkbox" data-skill="${s.id}" ${prof ? 'checked' : ''} disabled>
            <span>${s.label}</span>
            <span style="font-size:0.75rem;color:var(--text-dim);margin-left:0.3rem">(${ATTR_LABELS[s.attr].abbr})</span>
          </label>
          <span class="skill-mod">${fmt.modifier(mod)}</span>
        </div>`;
    }).join('');

    return `
      <div class="card mb-2">
        <div class="card-title">Perícias</div>
        <div class="skill-list">${rows}</div>
      </div>`;
  };

  const _renderProfBlock = () => {
    const state = CharacterState.get();
    const p     = state.proficiencies || {};
    return `
      <div class="card mb-2">
        <div class="card-title">Proficiências & Idiomas</div>
        <div class="form-group mb-1">
          <label>Armaduras</label>
          <textarea class="form-control" style="min-height:50px" data-field="proficiencies.armor">${p.armor||''}</textarea>
        </div>
        <div class="form-group mb-1">
          <label>Armas</label>
          <textarea class="form-control" style="min-height:50px" data-field="proficiencies.weapons">${p.weapons||''}</textarea>
        </div>
        <div class="form-group mb-1">
          <label>Ferramentas</label>
          <textarea class="form-control" style="min-height:50px" data-field="proficiencies.tools">${p.tools||''}</textarea>
        </div>
        <div class="form-group mb-0">
          <label>Idiomas</label>
          <textarea class="form-control" style="min-height:50px" data-field="proficiencies.languages">${p.languages||''}</textarea>
        </div>
      </div>`;
  };

  const _renderCombatBlock = () => {
    const c = CharacterState.get().combat || {};
    const passive = c.passivePerception || (10 + CharacterState.getSkillMod('perception'));
    return `
      <div class="card mb-2">
        <div class="card-title">Combate</div>
        <div class="combat-row">
          <div class="combat-stat-box">
            <input type="number" class="val" id="sheet-ac" value="${c.ac||10}">
            <div class="lbl-sm">C.A.</div>
          </div>
          <div class="combat-stat-box">
            <input type="number" class="val" id="sheet-init" value="${CharacterState.getModifier('dex')}" readonly>
            <div class="lbl-sm">Iniciativa</div>
          </div>
          <div class="combat-stat-box">
            <input type="text" class="val" id="sheet-speed" value="${c.speed||9}m" style="width:100%">
            <div class="lbl-sm">Deslocamento</div>
          </div>
          <div class="combat-stat-box">
            <input type="number" class="val" value="${passive}" readonly>
            <div class="lbl-sm">Percepção Passiva</div>
          </div>
        </div>
        <div class="form-row mt-1" style="gap:0.5rem">
          <div>
            <label style="font-family:var(--font-heading);font-size:0.65rem;text-transform:uppercase;letter-spacing:1.5px;color:var(--text-muted)">Dados de Vida</label>
            <input type="text" class="form-control" id="sheet-hitdice" value="${c.hitDice||'1d8'}">
          </div>
          <div>
            <label style="font-family:var(--font-heading);font-size:0.65rem;text-transform:uppercase;letter-spacing:1.5px;color:var(--text-muted)">XP</label>
            <input type="number" class="form-control" id="sheet-xp" value="${CharacterState.get().identity?.xp||0}" min="0">
          </div>
        </div>
      </div>`;
  };

  const _renderHPBlock = () => {
    const hp = CharacterState.get().combat?.hp || { current: 10, max: 10, temp: 0 };
    const pct = Math.max(0, Math.min(100, (hp.current / (hp.max || 1)) * 100));
    const barColor = pct > 50 ? 'var(--crimson-bright)' : pct > 25 ? '#e09320' : '#e03e3e';
    const hdPool = CharacterState.get().combat?.hitDicePool || { total: 1, spent: 0, die: 8 };
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
        <div class="mt-1 text-muted" style="font-size:0.82rem">
          Dados de vida: ${Math.max(0, hdPool.total - hdPool.spent)}/${hdPool.total} (d${hdPool.die})
        </div>
      </div>`;
  };

  const _renderDeathSaves = () => {
    const ds = CharacterState.get().combat?.deathSaves ||
               { successes:[false,false,false], failures:[false,false,false] };
    const succBoxes = ds.successes.map((v,i) =>
      `<input type="checkbox" data-ds="success-${i}" ${v?'checked':''}>`).join(' ');
    const failBoxes = ds.failures.map((v,i) =>
      `<input type="checkbox" data-ds="failure-${i}" ${v?'checked':''}>`).join(' ');
    if ((CharacterState.get().combat?.hp?.current || 0) > 0) return '';
    return `
      <div class="card mb-2">
        <div class="card-title">Testes Contra a Morte</div>
        <div class="death-saves">
          <div class="ds-group">✓ Sucesso: ${succBoxes}</div>
          <div class="ds-group">✕ Falha: ${failBoxes}</div>
        </div>
      </div>`;
  };

  const _renderResourcesBlock = () => {
    const resources = CharacterState.get().resources || [];
    const rows = resources.length > 0
      ? resources.map((r, i) => `
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
          Recursos de Classe
          <button class="btn btn-ghost btn-sm" id="btn-add-resource">+ Recurso</button>
        </div>
        <div id="resources-list">${rows}</div>
      </div>`;
  };

  const _renderFeaturesBlock = () => {
    const state = CharacterState.get();
    const classId = state.progression?.classId || _resolveClassId(state.identity?.class);
    const features = _collectFeatures(classId, state.identity?.level || 1);
    return `
      <div class="card mb-2">
        <div class="card-title">Características & Talentos</div>
        <div class="skill-list">
          ${(features.length ? features : ['Nenhuma feature registrada']).map(f => `<div class="skill-row-item"><span>${f}</span></div>`).join('')}
        </div>
      </div>`;
  };

  const _renderTraitsBlock = () => {
    const t = CharacterState.get().traits || {};
    const fields = [
      { field: 'traits.personality', label: 'Traços de Personalidade', val: t.personality || '' },
      { field: 'traits.ideals',      label: 'Ideais',                   val: t.ideals      || '' },
      { field: 'traits.bonds',       label: 'Vínculos',                 val: t.bonds       || '' },
      { field: 'traits.flaws',       label: 'Defeitos',                 val: t.flaws       || '' },
      { field: 'traits.backstory',   label: 'História',                 val: t.backstory   || '' }
    ];
    const formFields = fields.map(f => `
      <div class="form-group mb-1">
        <label>${f.label}</label>
        <textarea class="form-control" data-field="${f.field}" style="min-height:60px">${f.val}</textarea>
      </div>`).join('');

    return `
      <div class="card mb-2">
        <div class="card-title">Personalidade & História</div>
        ${formFields}
      </div>`;
  };

  const _renderDiaryBlock = () => {
    const d = CharacterState.get().diary || {};
    return `
      <div class="card mb-2">
        <div class="card-title">Diário de Campanha</div>
        <div class="diary-layout">
          <div class="form-group mb-0">
            <label>Notas Gerais</label>
            <textarea class="diary-textarea" data-field="diary.notes">${d.notes||''}</textarea>
          </div>
          <div class="form-group mb-0">
            <label>Sessão / Campanha</label>
            <textarea class="diary-textarea" data-field="diary.campaign">${d.campaign||''}</textarea>
          </div>
        </div>
        <div class="form-group mt-1 mb-0">
          <label>Aliados & Organizações</label>
          <textarea class="form-control" data-field="diary.allies" style="min-height:70px">${d.allies||''}</textarea>
        </div>
      </div>`;
  };

  const _attachRegistroListeners = (el) => {
    // Generic data-field binders
    el.querySelectorAll('[data-field]').forEach(inp => {
      inp.addEventListener('change', () => {
        CharacterState.set(inp.dataset.field, inp.value);
      });
    });
    // Attribute direct editing
    el.querySelectorAll('.attr-score-input').forEach(inp => {
      inp.addEventListener('change', (e) => {
        const key = e.target.dataset.attrKey;
        const newTotal = parseInt(e.target.value) || 10;
        const state = CharacterState.get();
        const racialBonus = state.attributes[key].racialBonus || 0;
        
        // Atualiza a base deduzindo o bônus racial estático
        CharacterState.set(`attributes.${key}.base`, newTotal - racialBonus);
        
        // Re-renderiza o painel para atualizar modificadores, perícias e salvaguardas
        _renderRegistro();
      });
    });

    // HP
    const hpCurrent = document.getElementById('hp-current');
    const hpMax     = document.getElementById('hp-max');
    const hpTemp    = document.getElementById('hp-temp');
    const updateHP  = () => {
      const cur = parseInt(hpCurrent?.value) || 0;
      const max = parseInt(hpMax?.value)     || 1;
      const tmp = parseInt(hpTemp?.value)    || 0;
      const pct = Math.max(0, Math.min(100, (cur / max) * 100));
      const barColor = pct > 50 ? 'var(--crimson-bright)' : pct > 25 ? '#e09320' : '#e03e3e';
      const bar = document.getElementById('hp-bar-fill');
      if (bar) { bar.style.width = `${pct}%`; bar.style.background = barColor; }
      CharacterState.patch({ combat: { ...CharacterState.get().combat, hp: { current: cur, max, temp: tmp } } });
    };
    [hpCurrent, hpMax, hpTemp].forEach(el => el?.addEventListener('input', updateHP));

    // Combat fields
    document.getElementById('sheet-ac')?.addEventListener('change', e => {
      CharacterState.set('combat.ac', parseInt(e.target.value) || 10);
    });
    document.getElementById('sheet-speed')?.addEventListener('change', e => {
      CharacterState.set('combat.speed', e.target.value);
    });
    document.getElementById('sheet-hitdice')?.addEventListener('change', e => {
      CharacterState.set('combat.hitDice', e.target.value);
    });
    document.getElementById('sheet-xp')?.addEventListener('change', e => {
      CharacterState.set('identity.xp', parseInt(e.target.value) || 0);
    });
    document.getElementById('sheet-inspiration')?.addEventListener('change', e => {
      CharacterState.set('combat.inspiration', e.target.value);
    });

    // Skill proficiency toggles
    el.querySelectorAll('[data-skill]').forEach(chk => {
      chk.addEventListener('change', () => {
        const id    = chk.dataset.skill;
        const state = CharacterState.get();
        let prof    = [...(state.skills?.proficient || [])];
        if (chk.checked && !prof.includes(id)) prof.push(id);
        else if (!chk.checked) prof = prof.filter(s => s !== id);
        CharacterState.set('skills.proficient', prof);
        // Re-render skills block to update modifiers
        const skillEl = document.querySelector('.skill-list');
        if (skillEl) skillEl.innerHTML = SKILLS.map(s => {
          const mod  = CharacterState.getSkillMod(s.id);
          const p    = CharacterState.get().skills?.proficient?.includes(s.id);
          return `
            <div class="skill-row-item">
              <label class="skill-check">
            <input type="checkbox" data-skill="${s.id}" ${p ? 'checked' : ''} disabled>
                <span>${s.label}</span>
                <span style="font-size:0.75rem;color:var(--text-dim);margin-left:0.3rem">(${ATTR_LABELS[s.attr].abbr})</span>
              </label>
              <span class="skill-mod">${fmt.modifier(mod)}</span>
            </div>`;
        }).join('');
        // Re-attach skill listeners
        el.querySelectorAll('[data-skill]').forEach(c => {
          c.addEventListener('change', () => c.dispatchEvent(new Event('change')));
        });
      });
    });

    // Saving throw proficiency toggles
    el.querySelectorAll('[data-save]').forEach(chk => {
      chk.addEventListener('change', () => {
        const k     = chk.dataset.save;
        const state = CharacterState.get();
        let prof    = [...(state.savingThrows?.proficient || [])];
        if (chk.checked && !prof.includes(k)) prof.push(k);
        else if (!chk.checked) prof = prof.filter(s => s !== k);
        CharacterState.set('savingThrows.proficient', prof);
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
      });
    });

    // Resources
    document.getElementById('btn-add-resource')?.addEventListener('click', () => {
      const name = prompt('Nome do recurso (ex.: Canalizar Divindade):');
      if (!name?.trim()) return;
      const max = parseInt(prompt('Valor máximo:')) || 1;
      const state = CharacterState.get();
      const resources = [...(state.resources || []), { name: name.trim(), current: max, max }];
      CharacterState.set('resources', resources);
      _renderRegistro();
    });

    el.querySelectorAll('[data-res-idx]').forEach(inp => {
      inp.addEventListener('change', () => {
        const idx   = parseInt(inp.dataset.resIdx);
        const field = inp.dataset.resField;
        const state = CharacterState.get();
        const res   = [...(state.resources || [])];
        if (res[idx]) {
          res[idx][field] = Math.max(0, parseInt(inp.value) || 0);
          CharacterState.set('resources', res);
        }
      });
    });
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // PANEL 2 — INVENTÁRIO
  // ═══════════════════════════════════════════════════════════════════════════
  const _renderInventario = () => {
    const el = document.getElementById('panel-inventario');
    if (!el) return;
    InventoryModule.init(el);
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // PANEL 3 — GRIMÓRIO
  // ═══════════════════════════════════════════════════════════════════════════
  const _renderGrimorio = () => {
    const el = document.getElementById('panel-grimorio');
    if (!el) return;

    const state = CharacterState.get();
    const classId = state.progression?.classId || _resolveClassId(state.identity?.class);
    const classMeta = _classFeatures?.[classId];
    const spellMeta = classMeta?.spellcasting || { progression: 'none', ability: null, slotsByLevel: {} };
    const classLevel = state.identity?.level || 1;
    const slotTotals = spellMeta.slotsByLevel?.[classLevel] || [];
    const maxSpellLevel = slotTotals.length;
    const prepared  = state.spells?.prepared || [];
    const castingAbility = spellMeta.ability;
    const prepLimit = castingAbility ? Math.max(1, classLevel + CharacterState.getModifier(castingAbility)) : 0;
    if (spellMeta.progression !== 'none' && (!state.spells?.slots || Object.keys(state.spells.slots).length === 0)) {
      const initSlots = {};
      slotTotals.forEach((total, idx) => { initSlots[idx + 1] = { total, used: 0 }; });
      CharacterState.setSpellSlots(initSlots);
    }
    const levels    = [...new Set(_spells.map(s => s.level))].sort((a,b) => a - b);
    const filterOpts = [
      `<option value="all" ${_spellFilter==='all'?'selected':''}>Todos os Níveis</option>`,
      ...levels.map(l => `<option value="${l}" ${_spellFilter==l?'selected':''}>${SPELL_LEVEL_LABELS[l]||'Nível '+l}</option>`)
    ].join('');

    const classSpells = _spells.filter(s => !s.classes || s.classes.includes(classId) || s.classes.includes(state.identity?.class));
    const legalByLevel = classSpells.filter(s => s.level === 0 || s.level <= maxSpellLevel);
    const filteredSpells = _spellFilter === 'all'
      ? legalByLevel
      : legalByLevel.filter(s => s.level === parseInt(_spellFilter));

    // Group by level
    const grouped = {};
    filteredSpells.forEach(s => {
      if (!grouped[s.level]) grouped[s.level] = [];
      grouped[s.level].push(s);
    });

    const spellListHtml = Object.entries(grouped).sort((a,b) => a[0]-b[0]).map(([lvl, spells]) => {
      const spellItems = spells.map(s => {
        const isPrepared = prepared.includes(s.id);
        return `
          <div class="spell-entry ${isPrepared ? 'prepared' : ''}" id="spell-${s.id}">
            <input type="checkbox" class="spell-checkbox" data-spell-id="${s.id}" ${isPrepared ? 'checked' : ''}>
            <div class="spell-info">
              <div class="spell-name">${s.name}</div>
              <div class="spell-meta">
                <span class="badge badge-gold">${SPELL_LEVEL_LABELS[s.level] || 'Truque'}</span>
                <span class="badge badge-arcane">${s.school}</span>
                <span style="font-size:0.78rem;color:var(--text-dim)">${s.castingTime}</span>
              </div>
              <div class="spell-desc-text">${s.description}</div>
              <button class="spell-toggle" data-spell-toggle="${s.id}">▸ Ver detalhes</button>
            </div>
          </div>`;
      }).join('');

      return `
        <div style="margin-bottom:1.25rem">
          <div style="font-family:var(--font-heading);font-size:0.72rem;text-transform:uppercase;letter-spacing:2px;color:var(--gold-dim);margin-bottom:0.5rem;padding-bottom:0.35rem;border-bottom:1px solid var(--border-faint)">
            ${SPELL_LEVEL_LABELS[lvl] || 'Nível '+lvl}
          </div>
          ${spellItems}
        </div>`;
    }).join('');

    const activeSpellItems = prepared.length > 0
      ? prepared.map(id => {
          const spell = _spells.find(s => s.id === id);
          if (!spell) return '';
          return `
            <div class="active-spell-item">
              <span class="active-spell-name">${spell.name}</span>
              <span class="active-spell-level">${SPELL_LEVEL_LABELS[spell.level]||'Truque'}</span>
            </div>`;
        }).join('')
      : `<div class="spells-empty">Nenhuma magia preparada.<br>Marque as caixas ao lado.</div>`;

    const slotCards = slotTotals.map((total, idx) => {
      const level = idx + 1;
      const used = state.spells?.slots?.[level]?.used || 0;
      const checks = Array.from({ length: total }).map((_, i) =>
        `<label><input type="checkbox" data-slot-level="${level}" data-slot-idx="${i}" ${i < used ? 'checked' : ''}></label>`).join('');
      const pactLabel = spellMeta.progression === 'pact' ? ` (Nível ${spellMeta.pactSlotLevelByClassLevel?.[classLevel] || level})` : '';
      return `<div class="card mb-1"><div class="card-title">${SPELL_LEVEL_LABELS[level] || `${level}º`}${pactLabel}</div><div class="death-saves">${checks}</div></div>`;
    }).join('');

    el.innerHTML = `
      <div class="grimoire-layout">
        <div>
          ${spellMeta.progression !== 'none' ? `<div class="mb-1 text-muted">Magias preparadas: ${prepared.length}/${prepLimit}</div>` : '<div class="mb-1 text-muted">Classe sem conjuração.</div>'}
          <div class="spell-filters">
            <span class="filter-label">Filtrar:</span>
            <select class="filter-select" id="spell-level-filter">${filterOpts}</select>
            <span style="font-size:0.82rem;color:var(--text-muted)">${legalByLevel.length} magias disponíveis</span>
          </div>
          <div id="spell-list-container">${spellListHtml}</div>
        </div>
        <div class="active-spells-panel">
          ${slotCards}
          <div class="card" style="position:sticky;top:1rem">
            <div class="card-title">✦ Magias Ativas (${prepared.length})</div>
            <div id="active-spells-list">${activeSpellItems}</div>
          </div>
        </div>
      </div>`;

    // Listeners
    document.getElementById('spell-level-filter')?.addEventListener('change', (e) => {
      _spellFilter = e.target.value;
      _renderGrimorio();
    });

    el.querySelectorAll('.spell-checkbox').forEach(chk => {
      chk.addEventListener('change', () => {
        const id = chk.dataset.spellId;
        if (chk.checked) {
          const ok = CharacterState.prepareSpell(id, prepLimit);
          if (!ok) {
            chk.checked = false;
            Toast.show(`Limite de preparo atingido (${prepLimit}).`);
            return;
          }
        }
        else CharacterState.unprepareSpell(id);

        const entry = document.getElementById(`spell-${id}`);
        if (entry) entry.classList.toggle('prepared', chk.checked);

        // Update active spells panel
        const prepared = CharacterState.get().spells?.prepared || [];
        const listEl   = document.getElementById('active-spells-list');
        if (listEl) {
          if (prepared.length === 0) {
            listEl.innerHTML = `<div class="spells-empty">Nenhuma magia preparada.</div>`;
          } else {
            listEl.innerHTML = prepared.map(sid => {
              const s = _spells.find(sp => sp.id === sid);
              return s ? `
                <div class="active-spell-item">
                  <span class="active-spell-name">${s.name}</span>
                  <span class="active-spell-level">${SPELL_LEVEL_LABELS[s.level]||'Truque'}</span>
                </div>` : '';
            }).join('');
          }
          // Update count
          el.querySelector('.card-title').textContent = `✦ Magias Ativas (${prepared.length})`;
        }
      });
    });

    el.querySelectorAll('[data-slot-level]').forEach(chk => {
      chk.addEventListener('change', () => {
        const level = parseInt(chk.dataset.slotLevel, 10);
        if (chk.checked) CharacterState.useSpellSlot(level);
        else CharacterState.restoreSpellSlot(level);
      });
    });

    el.querySelectorAll('[data-spell-toggle]').forEach(btn => {
      btn.addEventListener('click', () => {
        const entry = document.getElementById(`spell-${btn.dataset.spellToggle}`);
        if (entry) {
          const expanded = entry.classList.toggle('expanded');
          btn.textContent = expanded ? '▾ Ocultar detalhes' : '▸ Ver detalhes';
        }
      });
    });
  };

  const _resolveClassId = (className = '') => {
    const map = {
      'Bárbaro': 'barbarian', 'Bardo': 'bard', 'Clérigo': 'cleric', 'Druida': 'druid',
      'Guerreiro': 'fighter', 'Monge': 'monk', 'Paladino': 'paladin', 'Patrulheiro': 'ranger',
      'Ladino': 'rogue', 'Feiticeiro': 'sorcerer', 'Bruxo': 'warlock', 'Mago': 'wizard'
    };
    return map[className] || '';
  };

  const _collectFeatures = (classId, level) => {
    const byLevel = _classFeatures?.[classId]?.featuresByLevel || {};
    const out = [];
    Object.keys(byLevel).map(n => parseInt(n, 10)).sort((a, b) => a - b).forEach(lv => {
      if (lv <= level) out.push(...byLevel[String(lv)]);
    });
    return out;
  };

  const _handleLevelUp = () => {
    const state = CharacterState.get();
    const next = Math.min(20, (state.identity?.level || 1) + 1);
    if (next === state.identity.level) return Toast.show('Nível máximo atingido.');
    const useAvg = confirm('Usar média oficial no ganho de HP?\nOK = média oficial, Cancelar = rolar dado');
    const hitDie = state.progression?.hitDie || 8;
    const conMod = CharacterState.getModifier('con');
    const gain = useAvg ? (Math.floor(hitDie / 2) + 1 + conMod) : ((Math.floor(Math.random() * hitDie) + 1) + conMod);
    const hpGain = Math.max(1, gain);
    const max = (state.combat?.hp?.max || 1) + hpGain;
    const cur = (state.combat?.hp?.current || 1) + hpGain;
    const hdPool = state.combat?.hitDicePool || { total: 1, spent: 0, die: hitDie };
    const classId = state.progression?.classId || _resolveClassId(state.identity?.class);
    const spellMeta = _classFeatures?.[classId]?.spellcasting || { slotsByLevel: {} };
    const newSlots = spellMeta.slotsByLevel?.[next] || [];
    const mergedSlots = {};
    newSlots.forEach((total, idx) => {
      const lv = idx + 1;
      const prevUsed = state.spells?.slots?.[lv]?.used || 0;
      mergedSlots[lv] = { total, used: Math.min(prevUsed, total) };
    });
    CharacterState.patch({
      identity: { ...state.identity, level: next },
      combat: {
        ...state.combat,
        hp: { ...state.combat.hp, max, current: cur },
        hitDice: `${next}d${hitDie}`,
        hitDicePool: { ...hdPool, total: next }
      },
      spells: {
        ...state.spells,
        slots: mergedSlots
      },
      features: _collectFeatures(classId, next)
    });
    CharacterState.recalcAc();
    CharacterState.recalcAttacks();
    Toast.show(`Nível ${next} alcançado. HP +${hpGain}.`);
    _render();
  };

  const _handleShortRest = () => {
    const state = CharacterState.get();
    const pool = state.combat?.hitDicePool || { total: 1, spent: 0, die: 8 };
    const available = Math.max(0, pool.total - pool.spent);
    if (available <= 0) return Toast.show('Sem dados de vida disponíveis.');
    const spend = Math.min(available, Math.max(1, parseInt(prompt(`Quantos dados de vida gastar? (1-${available})`) || '1', 10)));
    const conMod = CharacterState.getModifier('con');
    let heal = 0;
    for (let i = 0; i < spend; i++) heal += Math.max(1, (Math.floor(Math.random() * pool.die) + 1) + conMod);
    const hp = state.combat.hp;
    CharacterState.patch({
      combat: {
        ...state.combat,
        hp: { ...hp, current: Math.min(hp.max, hp.current + heal) },
        hitDicePool: { ...pool, spent: pool.spent + spend }
      }
    });
    Toast.show(`Descanso curto: +${heal} HP (dados gastos: ${spend}).`);
    _renderActivePanel();
  };

  return { init };
})();
