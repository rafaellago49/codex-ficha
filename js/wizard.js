/**
 * wizard.js — Character Creation Wizard
 * Multi-step form: Race → Class → Attributes → Details → Finish
 */

import { CharacterState, DataLoader, Toast, fmt } from './app.js';

const CLASSES = [
  { id: 'barbarian',  name: 'Bárbaro',       icon: '⚔️',  hitDie: 'd12', saves: ['str', 'con'] },
  { id: 'bard',       name: 'Bardo',          icon: '🎶',  hitDie: 'd8',  saves: ['dex', 'cha'] },
  { id: 'cleric',     name: 'Clérigo',        icon: '✝️',  hitDie: 'd8',  saves: ['wis', 'cha'] },
  { id: 'druid',      name: 'Druida',         icon: '🌿',  hitDie: 'd8',  saves: ['int', 'wis'] },
  { id: 'fighter',    name: 'Guerreiro',      icon: '🛡️',  hitDie: 'd10', saves: ['str', 'con'] },
  { id: 'monk',       name: 'Monge',          icon: '👊',  hitDie: 'd8',  saves: ['str', 'dex'] },
  { id: 'paladin',    name: 'Paladino',       icon: '⚜️',  hitDie: 'd10', saves: ['wis', 'cha'] },
  { id: 'ranger',     name: 'Patrulheiro',    icon: '🏹',  hitDie: 'd10', saves: ['str', 'dex'] },
  { id: 'rogue',      name: 'Ladino',         icon: '🗡️',  hitDie: 'd8',  saves: ['dex', 'int'] },
  { id: 'sorcerer',   name: 'Feiticeiro',     icon: '✨',  hitDie: 'd6',  saves: ['con', 'cha'] },
  { id: 'warlock',    name: 'Bruxo',          icon: '🌑',  hitDie: 'd8',  saves: ['wis', 'cha'] },
  { id: 'wizard',     name: 'Mago',           icon: '🔮',  hitDie: 'd6',  saves: ['int', 'wis'] }
];

const ATTR_LABELS = {
  str: { abbr: 'FOR', full: 'Força' },
  dex: { abbr: 'DES', full: 'Destreza' },
  con: { abbr: 'CON', full: 'Constituição' },
  int: { abbr: 'INT', full: 'Inteligência' },
  wis: { abbr: 'SAB', full: 'Sabedoria' },
  cha: { abbr: 'CAR', full: 'Carisma' }
};

const TOTAL_STEPS = 4;

export const Wizard = (() => {
  let _races     = [];
  let _container = null;
  let _step      = 1;

  // Internal wizard state (before committing to CharacterState)
  let _draft = {
    raceId:   null,
    race:     null,
    classId:  null,
    classObj: null,
    choosableBonuses: [],   // for races like Half-Elf
    attributes: {
      str: { base: 10 },
      dex: { base: 10 },
      con: { base: 10 },
      int: { base: 10 },
      wis: { base: 10 },
      cha: { base: 10 }
    },
    details: {
      name: '', level: 1, background: '', alignment: '', playerName: ''
    }
  };

  // ── Public init ──────────────────────────────────────────────────────────
  const init = async (containerEl) => {
    _container = containerEl;
    _races = await DataLoader.load('./data/races.json') || [];
    _step  = 1;
    _draft = {
      raceId: null, race: null, classId: null, classObj: null,
      choosableBonuses: [],
      attributes: { str:{base:10},dex:{base:10},con:{base:10},int:{base:10},wis:{base:10},cha:{base:10} },
      details: { name:'', level:1, background:'', alignment:'', playerName:'' }
    };
    _render();
  };

  // ── Render shell ─────────────────────────────────────────────────────────
  const _render = () => {
    _container.innerHTML = `
      <div class="wizard-shell">
        <div class="wizard-header">
          <h1>Criar Personagem</h1>
          <p class="text-muted mt-1">Preencha os dados para forjar seu herói</p>
          ${_renderStepBar()}
        </div>
        <div class="card" id="wizard-card">
          ${_renderStep()}
        </div>
        <div class="wizard-nav">
         <button class="btn btn-secondary" id="wiz-back">${_step === 1 ? 'Cancelar' : '← Voltar'}</button>
          <button class="btn btn-primary" id="wiz-next">
            ${_step === TOTAL_STEPS ? 'Criar Personagem ✦' : 'Avançar →'}
          </button>
        </div>
      </div>`;

    document.getElementById('wiz-back')?.addEventListener('click', _prevStep);
    document.getElementById('wiz-next')?.addEventListener('click', _nextStep);

    _attachStepListeners();
  };

  const _renderStepBar = () => {
    const labels = ['Raça', 'Classe', 'Atributos', 'Detalhes'];
    let html = '<div class="wizard-step-bar">';
    labels.forEach((lbl, i) => {
      const n = i + 1;
      let cls = 'step-dot';
      if (n < _step) cls += ' done';
      else if (n === _step) cls += ' active';
      html += `<div class="${cls}" title="${lbl}">${n < _step ? '✓' : n}</div>`;
      if (i < labels.length - 1) {
        html += `<div class="step-line ${n < _step ? 'done' : ''}"></div>`;
      }
    });
    html += '</div>';
    return html;
  };

  const _renderStep = () => {
    switch (_step) {
      case 1: return _renderRaceStep();
      case 2: return _renderClassStep();
      case 3: return _renderAttrStep();
      case 4: return _renderDetailsStep();
      default: return '';
    }
  };

  // ── Step 1: Race ──────────────────────────────────────────────────────────
  const _renderRaceStep = () => {
    let grid = _races.map(race => {
      const bonusText = _raceBonusSummary(race);
      const sel = _draft.raceId === race.id ? 'selected' : '';
      return `
        <div class="race-card ${sel}" data-race-id="${race.id}">
          <div class="race-name">${race.name}</div>
          <div class="race-bonus">${bonusText}</div>
        </div>`;
    }).join('');

    const choosableHtml = _draft.race?.choosableBonus ? _renderChoosableBonus() : '';

    return `
      <div class="wizard-step active">
        <div class="wizard-step-title">Etapa 1 de ${TOTAL_STEPS}</div>
        <h2>Escolha sua Raça</h2>
        <p class="text-muted mb-2" style="font-size:0.9rem">A raça define os modificadores raciais aplicados sobre os atributos base.</p>
        <div class="race-grid">${grid}</div>
        <div id="choosable-bonus-container">${choosableHtml}</div>
      </div>`;
  };

  const _raceBonusSummary = (race) => {
    const parts = [];
    Object.entries(race.abilityBonuses || {}).forEach(([k, v]) => {
      parts.push(`${ATTR_LABELS[k]?.abbr || k} +${v}`);
    });
    if (race.choosableBonus) {
      parts.push(`+${race.choosableBonus.amount} (×${race.choosableBonus.count} à escolha)`);
    }
    return parts.join(', ') || '—';
  };

  const _renderChoosableBonus = () => {
    if (!_draft.race?.choosableBonus) return '';
    const cb = _draft.race.choosableBonus;
    const eligible = Object.keys(ATTR_LABELS).filter(k => !cb.exclude?.includes(k));
    const checkboxes = eligible.map(k => {
      const checked   = _draft.choosableBonuses.includes(k);
      const selClass  = checked ? 'selected' : '';
      return `
        <label class="choosable-check-label ${selClass}">
          <input type="checkbox" data-choosable="${k}" ${checked ? 'checked' : ''}>
          ${ATTR_LABELS[k].abbr} (+${cb.amount})
        </label>`;
    }).join('');

    return `
      <div class="choosable-bonus-section mt-2">
        <p>${cb.description} (${_draft.choosableBonuses.length}/${cb.count} selecionados)</p>
        <div class="choosable-checkboxes">${checkboxes}</div>
      </div>`;
  };

  // ── Step 2: Class ─────────────────────────────────────────────────────────
  const _renderClassStep = () => {
    const grid = CLASSES.map(cls => {
      const sel = _draft.classId === cls.id ? 'selected' : '';
      return `
        <div class="class-card ${sel}" data-class-id="${cls.id}">
          <div class="class-icon">${cls.icon}</div>
          <div class="class-name">${cls.name}</div>
          <div style="font-size:0.72rem;color:var(--text-dim);margin-top:0.15rem">${cls.hitDie}</div>
        </div>`;
    }).join('');

    return `
      <div class="wizard-step active">
        <div class="wizard-step-title">Etapa 2 de ${TOTAL_STEPS}</div>
        <h2>Escolha sua Classe</h2>
        <p class="text-muted mb-2" style="font-size:0.9rem">Qualquer raça pode ser qualquer classe. Sem restrições.</p>
        <div class="class-grid">${grid}</div>
      </div>`;
  };

  // ── Step 3: Attributes ────────────────────────────────────────────────────
  const _renderAttrStep = () => {
    const rows = Object.entries(ATTR_LABELS).map(([key, labels]) => {
      const base    = _draft.attributes[key].base;
      const racial  = _getRacialBonus(key);
      const total   = base + racial;
      const mod     = Math.floor((total - 10) / 2);
      const racialTxt = racial !== 0 ? fmt.modifier(racial) : '—';

      return `
        <div class="attr-row" data-attr="${key}">
          <div class="attr-label-block">
            <div class="lbl">${labels.abbr}</div>
            <div class="full-name">${labels.full}</div>
          </div>
          <div class="attr-number-block">
            <div style="font-size:0.6rem;color:var(--text-dim);letter-spacing:1px">BASE</div>
            <input type="number" class="attr-base-input" data-attr-key="${key}"
              value="${base}" min="1" max="20">
          </div>
          <div class="attr-number-block">
            <div style="font-size:0.6rem;color:var(--text-dim);letter-spacing:1px">RACIAL</div>
            <div class="attr-race-bonus">${racialTxt}</div>
          </div>
          <div class="attr-number-block">
            <div style="font-size:0.6rem;color:var(--text-dim);letter-spacing:1px">TOTAL</div>
            <div class="attr-total" id="attr-total-${key}">${total}</div>
          </div>
          <div class="attr-number-block">
            <div style="font-size:0.6rem;color:var(--text-dim);letter-spacing:1px">MOD</div>
            <div class="attr-mod" id="attr-mod-${key}">${fmt.modifier(mod)}</div>
          </div>
        </div>`;
    }).join('');

    return `
      <div class="wizard-step active">
        <div class="wizard-step-title">Etapa 3 de ${TOTAL_STEPS}</div>
        <h2>Distribuir Atributos</h2>
        <p class="text-muted mb-2" style="font-size:0.9rem">
          Insira os valores base obtidos nos dados. Os bônus raciais são aplicados automaticamente.
        </p>
        ${_draft.race ? `<p style="font-size:0.82rem;color:var(--arcane-bright);margin-bottom:1rem">
          ✦ Modificadores raciais: ${_raceBonusSummary(_draft.race)}
        </p>` : ''}
        <div class="attr-builder">${rows}</div>
      </div>`;
  };

  const _getRacialBonus = (attrKey) => {
    if (!_draft.race) return 0;
    const fixed = _draft.race.abilityBonuses?.[attrKey] || 0;
    const cb = _draft.race.choosableBonus;
    const choosable = cb && _draft.choosableBonuses.includes(attrKey) ? cb.amount : 0;
    return fixed + choosable;
  };

  // ── Step 4: Details ───────────────────────────────────────────────────────
  const _renderDetailsStep = () => {
    const d = _draft.details;
    const alignments = ['Leal e Bom','Neutro e Bom','Caótico e Bom','Leal e Neutro','Neutro','Caótico e Neutro','Leal e Mau','Neutro e Mau','Caótico e Mau'];
    const alignOpts = alignments.map(a => `<option ${d.alignment===a?'selected':''}>${a}</option>`).join('');

    return `
      <div class="wizard-step active">
        <div class="wizard-step-title">Etapa 4 de ${TOTAL_STEPS}</div>
        <h2>Detalhes do Personagem</h2>
        <div class="form-group mt-2">
          <label>Nome do Personagem *</label>
          <input type="text" class="form-control" id="wiz-name" value="${d.name}" placeholder="Ex.: Faenor Montclair" required>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Nível Inicial</label>
            <input type="number" class="form-control" id="wiz-level" value="${d.level}" min="1" max="20">
          </div>
          <div class="form-group">
            <label>Alinhamento</label>
            <select class="form-control" id="wiz-alignment">
              <option value="">Selecionar...</option>
              ${alignOpts}
            </select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Antecedente</label>
            <input type="text" class="form-control" id="wiz-background" value="${d.background}" placeholder="Ex.: Nobre, Soldado...">
          </div>
          <div class="form-group">
            <label>Nome do Jogador</label>
            <input type="text" class="form-control" id="wiz-player" value="${d.playerName}" placeholder="Seu nome">
          </div>
        </div>
        <div class="card mt-2" style="font-size:0.88rem; border-color:var(--border-gold);">
          <div class="card-title">Resumo</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;color:var(--text-muted)">
            <div>Raça: <strong style="color:var(--text-primary)">${_draft.race?.name || '—'}</strong></div>
            <div>Classe: <strong style="color:var(--text-primary)">${_draft.classObj?.name || '—'}</strong></div>
          </div>
        </div>
      </div>`;
  };

  // ── Navigation ────────────────────────────────────────────────────────────
  const _nextStep = () => {
    if (!_validateStep()) return;
    if (_step === TOTAL_STEPS) { _finalize(); return; }
    _step++;
    _render();
  };

  const _prevStep = () => {
    if (_step === 1) {
      // Se estiver no primeiro passo, cancela a criação e volta pra Home
      window.dispatchEvent(new CustomEvent('navigate-home'));
    } else {
      // Se estiver nos outros passos, apenas volta um passo
      _step--; 
      _render(); 
    }
  };

  const _validateStep = () => {
    switch (_step) {
      case 1:
        if (!_draft.raceId) { Toast.show('Selecione uma raça.'); return false; }
        if (_draft.race?.choosableBonus) {
          const needed = _draft.race.choosableBonus.count;
          if (_draft.choosableBonuses.length !== needed) {
            Toast.show(`Selecione exatamente ${needed} atributo(s) para o bônus racial.`);
            return false;
          }
        }
        return true;
      case 2:
        if (!_draft.classId) { Toast.show('Selecione uma classe.'); return false; }
        return true;
      case 3:
        // Collect attribute inputs
        document.querySelectorAll('.attr-base-input').forEach(inp => {
          const k = inp.dataset.attrKey;
          const v = Math.max(1, Math.min(20, parseInt(inp.value) || 10));
          _draft.attributes[k].base = v;
        });
        return true;
      case 4:
        const name = document.getElementById('wiz-name')?.value.trim();
        if (!name) { Toast.show('O nome do personagem é obrigatório.'); return false; }
        _draft.details.name       = name;
        _draft.details.level      = parseInt(document.getElementById('wiz-level')?.value) || 1;
        _draft.details.alignment  = document.getElementById('wiz-alignment')?.value || '';
        _draft.details.background = document.getElementById('wiz-background')?.value.trim() || '';
        _draft.details.playerName = document.getElementById('wiz-player')?.value.trim() || '';
        return true;
    }
    return true;
  };

  // ── Commit to CharacterState ──────────────────────────────────────────────
  const _finalize = () => {
    const cls  = _draft.classObj;
    const race = _draft.race;

    // Build attribute state
    const attrs = {};
    Object.keys(_draft.attributes).forEach(k => {
      attrs[k] = {
        base:        _draft.attributes[k].base,
        racialBonus: _getRacialBonus(k)
      };
    });

    // HP: max = hitDie max + CON mod × level
    const conTotal  = (attrs.con.base + attrs.con.racialBonus);
    const conMod    = Math.floor((conTotal - 10) / 2);
    const hitDieMax = parseInt((cls?.hitDie || 'd8').replace('d', '')) || 8;
    const lvl       = _draft.details.level;
    const maxHP     = hitDieMax + conMod + ((lvl - 1) * (Math.floor(hitDieMax / 2) + 1 + conMod));

    CharacterState.patch({
      identity: {
        name:        _draft.details.name,
        race:        race?.name || '',
        raceId:      _draft.raceId,
        class:       cls?.name || '',
        level:       lvl,
        background:  _draft.details.background,
        alignment:   _draft.details.alignment,
        playerName:  _draft.details.playerName,
        xp:          0
      },
      attributes: attrs,
      combat: {
        hp:       { current: maxHP, max: maxHP, temp: 0 },
        ac:       10,
        initiative: Math.floor(((attrs.dex.base + attrs.dex.racialBonus) - 10) / 2),
        speed:    race?.speed || 9,
        hitDice:  `${lvl}${cls?.hitDie || 'd8'}`,
        deathSaves: { successes: [false,false,false], failures: [false,false,false] }
      },
      savingThrows: { proficient: cls?.saves || [] },
      proficiencies: {
        armor:     '',
        weapons:   '',
        tools:     '',
        languages: (race?.languages || ['Comum']).join(', ')
      }
    });

    Toast.show(`✦ ${_draft.details.name} foi criado com sucesso!`);
    window.dispatchEvent(new CustomEvent('wizard-complete'));
  };

  // ── Attach step-specific listeners ───────────────────────────────────────
  const _attachStepListeners = () => {
    if (_step === 1) {
      document.querySelectorAll('.race-card').forEach(card => {
        card.addEventListener('click', () => {
          const raceId = card.dataset.raceId;
          _draft.raceId = raceId;
          _draft.race   = _races.find(r => r.id === raceId);
          _draft.choosableBonuses = [];
          document.querySelectorAll('.race-card').forEach(c => c.classList.remove('selected'));
          card.classList.add('selected');

          // Re-render choosable bonus section
          const container = document.getElementById('choosable-bonus-container');
          if (container) {
            container.innerHTML = _draft.race?.choosableBonus ? _renderChoosableBonus() : '';
            _attachChoosableListeners();
          }
        });
      });
      _attachChoosableListeners();
    }

    if (_step === 2) {
      document.querySelectorAll('.class-card').forEach(card => {
        card.addEventListener('click', () => {
          _draft.classId  = card.dataset.classId;
          _draft.classObj = CLASSES.find(c => c.id === _draft.classId);
          document.querySelectorAll('.class-card').forEach(c => c.classList.remove('selected'));
          card.classList.add('selected');
        });
      });
    }

    if (_step === 3) {
      document.querySelectorAll('.attr-base-input').forEach(inp => {
        inp.addEventListener('input', () => {
          const k   = inp.dataset.attrKey;
          const v   = Math.max(1, Math.min(20, parseInt(inp.value) || 1));
          const racial = _getRacialBonus(k);
          const total  = v + racial;
          const mod    = Math.floor((total - 10) / 2);
          document.getElementById(`attr-total-${k}`).textContent = total;
          document.getElementById(`attr-mod-${k}`).textContent   = fmt.modifier(mod);
          _draft.attributes[k].base = v;
        });
      });
    }
  };

  const _attachChoosableListeners = () => {
    document.querySelectorAll('[data-choosable]').forEach(chk => {
      chk.addEventListener('change', () => {
        const key = chk.dataset.choosable;
        const cb  = _draft.race?.choosableBonus;
        if (!cb) return;

        if (chk.checked) {
          if (_draft.choosableBonuses.length >= cb.count) {
            chk.checked = false;
            Toast.show(`Você pode escolher apenas ${cb.count} atributo(s).`);
            return;
          }
          _draft.choosableBonuses.push(key);
        } else {
          _draft.choosableBonuses = _draft.choosableBonuses.filter(k => k !== key);
        }

        // Update label styling
        chk.closest('.choosable-check-label').classList.toggle('selected', chk.checked);

        // Update counter
        const section = chk.closest('.choosable-bonus-section');
        const p = section?.querySelector('p');
        if (p) {
          p.textContent = `${cb.description} (${_draft.choosableBonuses.length}/${cb.count} selecionados)`;
        }
      });
    });
  };

  return { init };
})();
