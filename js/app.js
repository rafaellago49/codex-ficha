/**
 * app.js — Core: State Management, Routing, Persistence
 * Versão 5 — Sistema de magias refatorado: known/prepared split,
 * getMaxPrepared com tabelas PHB precisas, grimório do Mago em duas etapas.
 */

const ImageStorage = {
    init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('DND_Vault', 1);
            request.onupgradeneeded = (event) => {
                event.target.result.createObjectStore('item_images');
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = (event) => reject(event.target.error);
        });
    },
    
    async save(id, base64String) {
        const db = await this.init();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction('item_images', 'readwrite');
            const store = transaction.objectStore('item_images');
            const request = store.put(base64String, id);
            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(false);
        });
    },
    
    async get(id) {
        const db = await this.init();
        return new Promise((resolve) => {
            const transaction = db.transaction('item_images', 'readonly');
            const store = transaction.objectStore('item_images');
            const request = store.get(id);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => resolve(null);
        });
    }
};

window.ImageStorage = ImageStorage;

// ══════════════════════════════════════════════════════════════════════════════
// TABELAS D&D 5e (PHB)
// ══════════════════════════════════════════════════════════════════════════════

/** Bónus de Proficiência por nível */
export const PROF_BY_LEVEL = [0,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,6,6,6,6];

/** Spell slots por classe e nível (full-casters) */
const SPELL_SLOTS_FULL = [
// nv  1  2  3  4  5  6  7  8  9
  [], // 0
  [2,0,0,0,0,0,0,0,0],  // 1
  [3,0,0,0,0,0,0,0,0],  // 2 — corrigido PHB: 3 slots 1º
  [4,2,0,0,0,0,0,0,0],  // 3
  [4,3,0,0,0,0,0,0,0],  // 4
  [4,3,2,0,0,0,0,0,0],  // 5
  [4,3,3,0,0,0,0,0,0],  // 6
  [4,3,3,1,0,0,0,0,0],  // 7
  [4,3,3,2,0,0,0,0,0],  // 8
  [4,3,3,3,1,0,0,0,0],  // 9
  [4,3,3,3,2,0,0,0,0],  // 10
  [4,3,3,3,2,1,0,0,0],  // 11
  [4,3,3,3,2,1,0,0,0],  // 12
  [4,3,3,3,2,1,1,0,0],  // 13
  [4,3,3,3,2,1,1,0,0],  // 14
  [4,3,3,3,2,1,1,1,0],  // 15
  [4,3,3,3,2,1,1,1,0],  // 16
  [4,3,3,3,2,1,1,1,1],  // 17
  [4,3,3,3,3,1,1,1,1],  // 18
  [4,3,3,3,3,2,1,1,1],  // 19
  [4,3,3,3,3,2,2,1,1],  // 20
];

const SPELL_SLOTS_HALF = [
  [], [],
  [2,0,0,0,0,0,0,0,0],  // 2
  [3,0,0,0,0,0,0,0,0],  // 3
  [3,0,0,0,0,0,0,0,0],  // 4  — corrigido PHB Paladino/Patrulheiro
  [4,2,0,0,0,0,0,0,0],  // 5
  [4,2,0,0,0,0,0,0,0],  // 6
  [4,3,0,0,0,0,0,0,0],  // 7
  [4,3,0,0,0,0,0,0,0],  // 8
  [4,3,2,0,0,0,0,0,0],  // 9
  [4,3,2,0,0,0,0,0,0],  // 10
  [4,3,3,0,0,0,0,0,0],  // 11
  [4,3,3,0,0,0,0,0,0],  // 12
  [4,3,3,1,0,0,0,0,0],  // 13
  [4,3,3,1,0,0,0,0,0],  // 14
  [4,3,3,2,0,0,0,0,0],  // 15
  [4,3,3,2,0,0,0,0,0],  // 16
  [4,3,3,3,1,0,0,0,0],  // 17
  [4,3,3,3,1,0,0,0,0],  // 18
  [4,3,3,3,2,0,0,0,0],  // 19
  [4,3,3,3,2,0,0,0,0],  // 20
];

/**
 * Pact Magic slots (Warlock) — todos os slots são do mesmo nível (o mais alto
 * disponível), recuperados em descanso CURTO, não longo.
 * Formato: [qtd_slots, nivel_slot]
 */
const SPELL_SLOTS_PACT = [
  null,          // 0
  [1, 1],        // 1
  [2, 1],        // 2
  [2, 2],        // 3
  [2, 2],        // 4
  [2, 3],        // 5
  [2, 3],        // 6
  [2, 4],        // 7
  [2, 4],        // 8
  [2, 5],        // 9
  [2, 5],        // 10
  [3, 5],        // 11
  [3, 5],        // 12
  [3, 5],        // 13
  [3, 5],        // 14
  [3, 5],        // 15
  [3, 5],        // 16
  [4, 5],        // 17
  [4, 5],        // 18
  [4, 5],        // 19
  [4, 5],        // 20
];

// ══════════════════════════════════════════════════════════════════════════════
// TABELAS DE MAGIAS CONHECIDAS — PHB exatas por nível de classe
// Fonte de verdade para classes de "known spells" (Bardo, Feiticeiro, Bruxo,
// Patrulheiro). O Mago usa "known" apenas para o grimório físico.
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Magias Conhecidas por nível (excluindo truques).
 * Índice = nível do personagem (1–20).
 */
const KNOWN_SPELLS_TABLE = {
  // Bardo — PHB p.53
  bard:     [null, 4,5,6,7,8,9,10,11,12,14,15,15,16,18,19,19,20,22,22,22,22],
  // Feiticeiro — PHB p.99
  sorcerer: [null, 2,3,4,5,6,7,8,9,10,11,12,12,13,13,14,14,15,15,16,16,16],
  // Bruxo — PHB p.106
  warlock:  [null, 2,3,4,5,6,7,8,9,10,10,11,11,12,12,13,13,14,14,15,15,15],
  // Patrulheiro — PHB p.92
  ranger:   [null, 0,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,11],
};

/**
 * Truques conhecidos por classe e nível.
 * Índice = nível do personagem.
 */
const CANTRIPS_KNOWN_TABLE = {
  bard:     [null, 2,2,2,3,3,3,3,3,3,4,4,4,4,4,4,4,4,4,4,4],
  sorcerer: [null, 4,4,4,5,5,5,6,6,6,6,6,6,6,6,6,6,6,6,6,6],
  warlock:  [null, 2,2,2,3,3,3,3,3,3,4,4,4,4,4,4,4,4,4,4,4],
  // Ranger não tem truques
  wizard:   [null, 3,3,3,4,4,4,4,4,4,5,5,5,5,5,5,5,5,5,5,5],
  druid:    [null, 2,2,2,3,3,3,3,3,3,4,4,4,4,4,4,4,4,4,4,4],
  cleric:   [null, 3,3,3,4,4,4,4,4,4,5,5,5,5,5,5,5,5,5,5,5],
};

/**
 * Magias do grimório inicial do Mago (nível 1) + ganho por nível.
 * Nível 1: 6 magias (3 nível 1 de escolha livre + 3 copiadas). Simplificado
 * como 6 no estado inicial; a cada level-up o jogador copia 2 magias.
 * Essa tabela armazena o TOTAL acumulado esperado no grimório.
 * (Para fins de UI — o estado real é o array `known` do personagem.)
 */
export const WIZARD_GRIMOIRE_START = 6;
export const WIZARD_GRIMOIRE_PER_LEVEL = 2;

/** Tipo de conjurador por classe */
export const CASTER_TYPE = {
  bard:'full', cleric:'full', druid:'full', sorcerer:'full', wizard:'full',
  warlock:'pact',   // Magia de Pacto — slots únicos recuperados em descanso curto
  paladin:'half', ranger:'half',
  barbarian:'none', fighter:'none', monk:'none', rogue:'none'
};

/**
 * Sub-tipo de conjurador — determina o FLUXO da interface do grimório.
 *  'prepared-list'  → Clérigo, Druida: prepara da lista completa da classe
 *  'prepared-half'  → Paladino, Patrulheiro: prepara da lista (½ conjurador)
 *  'known-fixed'    → Bardo, Feiticeiro, Bruxo: magias fixas, troca só no LvlUp
 *  'grimoire'       → Mago: duas etapas — grimório (known) → preparadas (prepared)
 *  'none'           → sem magia
 */
export const CASTER_SUBTYPE = {
  cleric:    'prepared-list',
  druid:     'prepared-list',
  paladin:   'prepared-half',
  ranger:    'prepared-half',
  bard:      'known-fixed',
  sorcerer:  'known-fixed',
  warlock:   'known-fixed',
  wizard:    'grimoire',
  barbarian: 'none', fighter: 'none', monk: 'none', rogue: 'none'
};

/** Atributo de conjuração por classe */
export const CASTING_ATTR = {
  bard:'cha', cleric:'wis', druid:'wis', sorcerer:'cha', wizard:'int',
  warlock:'cha', paladin:'cha', ranger:'wis'
};

/**
 * Dado de vida canônico por classe (PHB).
 */
export const HIT_DIE_BY_CLASS = {
  barbarian: 12,
  fighter: 10, paladin: 10, ranger: 10,
  bard: 8, cleric: 8, druid: 8, monk: 8, rogue: 8, warlock: 8,
  sorcerer: 6, wizard: 6
};

/**
 * Níveis de ASI por classe.
 */
const ASI_LEVELS = {
  barbarian: [4, 8, 12, 16, 19],
  bard:      [4, 8, 12, 16, 19],
  cleric:    [4, 8, 12, 16, 19],
  druid:     [4, 8, 12, 16, 19],
  fighter:   [4, 6, 8, 12, 14, 16, 19],
  monk:      [4, 8, 12, 16, 19],
  paladin:   [4, 8, 12, 16, 19],
  ranger:    [4, 8, 12, 16, 19],
  rogue:     [4, 8, 10, 12, 16, 19],
  sorcerer:  [4, 8, 12, 16, 19],
  warlock:   [4, 8, 12, 16, 19],
  wizard:    [4, 8, 12, 16, 19]
};

/** Calcula spell slots para uma classe e nível */
export function getSpellSlots(classId, level) {
  const type = CASTER_TYPE[classId] || 'none';
  if (type === 'none') return [];
  if (type === 'pact') {
    const entry = SPELL_SLOTS_PACT[Math.min(level, 20)];
    if (!entry) return [];
    const result = [0,0,0,0,0,0,0,0,0];
    result[entry[1] - 1] = entry[0];
    return result;
  }
  const table = type === 'half' ? SPELL_SLOTS_HALF : SPELL_SLOTS_FULL;
  return table[Math.min(level, 20)] || [];
}

/**
 * Retorna o nível máximo de slot disponível para uma classe/nível.
 * Usado para filtrar a lista de magias exibida no grimório.
 */
export function getMaxSpellLevel(classId, level) {
  const slots = getSpellSlots(classId, level);
  for (let i = slots.length - 1; i >= 0; i--) {
    if (slots[i] > 0) return i + 1;
  }
  return 0;
}

// ══════════════════════════════════════════════════════════════════════════════
// getMaxPrepared — FONTE DE VERDADE ÚNICA (refatorado)
// ══════════════════════════════════════════════════════════════════════════════
/**
 * Retorna o limite de magias que o personagem pode preparar/conhecer.
 *
 * @param {string}  classId         — ID da classe (ex: 'cleric')
 * @param {number}  level           — Nível atual do personagem
 * @param {number}  castingAttrMod  — Modificador do atributo de conjuração
 * @returns {{ type: 'prepared'|'known'|'grimoire'|'none', max: number|null }}
 *   type:
 *     'prepared'  → escolha diária limitada por fórmula (Clérigo, Druida, Paladino)
 *     'known'     → lista fixa com max de magias conhecidas (Bardo, Feiticeiro, Bruxo, Patrulheiro)
 *     'grimoire'  → Mago: grimório (known) + seleção diária (prepared = level + INT)
 *     'none'      → classe não conjuradora
 *   max:
 *     número máximo de magias no pool relevante; null para 'none'
 */
export function getMaxPrepared(classId, level, castingAttrMod) {
  const lvl = Math.min(Math.max(level, 1), 20);
  const mod = castingAttrMod || 0;

  switch (classId) {
    // ── Classes que PREPARAM da lista completa ────────────────────────────
    case 'cleric':
    case 'druid':
      return { type: 'prepared', max: Math.max(1, lvl + mod) };

    // ── Meio-conjuradores que PREPARAM ────────────────────────────────────
    case 'paladin':
      // Paladino começa a conjurar no nível 2; fórmula: floor(nível/2) + CARmod
      if (lvl < 2) return { type: 'prepared', max: 0 };
      return { type: 'prepared', max: Math.max(1, Math.floor(lvl / 2) + mod) };

    case 'ranger':
      // Patrulheiro usa "magias conhecidas" (tabela PHB) — não prepara
      // Nível 1 ainda não tem conjuração
      if (lvl < 2) return { type: 'known', max: 0 };
      return { type: 'known', max: KNOWN_SPELLS_TABLE.ranger[lvl] ?? 0 };

    // ── Classes de MAGIAS CONHECIDAS (lista fixa) ─────────────────────────
    case 'bard':
      return { type: 'known', max: KNOWN_SPELLS_TABLE.bard[lvl] ?? 0 };

    case 'sorcerer':
      return { type: 'known', max: KNOWN_SPELLS_TABLE.sorcerer[lvl] ?? 0 };

    case 'warlock':
      return { type: 'known', max: KNOWN_SPELLS_TABLE.warlock[lvl] ?? 0 };

    // ── Mago: grimório (known ilimitado) + prepared = nível + INTmod ──────
    case 'wizard':
      return { type: 'grimoire', max: Math.max(1, lvl + mod) };

    default:
      return { type: 'none', max: null };
  }
}

/**
 * Retorna o número de truques conhecidos para uma classe e nível.
 * Truques não contam no limite de preparação.
 */
export function getMaxCantrips(classId, level) {
  const lvl = Math.min(Math.max(level, 1), 20);
  return CANTRIPS_KNOWN_TABLE[classId]?.[lvl] ?? null;
}

// ══════════════════════════════════════════════════════════════════════════════
// CharacterState
// ══════════════════════════════════════════════════════════════════════════════
export const CharacterState = (() => {
  const STORAGE_KEY = 'rpg_character_sheet_v1';

  const _defaults = () => ({
    meta: { createdAt: new Date().toISOString(), version: 5 },
    identity: {
      name: '', race: '', raceId: '', class: '', classId: '', level: 1,
      background: '', alignment: '', xp: 0, playerName: '',
      subclass: ''   // subclasse escolhida (ex: 'life', 'devotion')
    },
    attributes: {
      str: { base: 10, racialBonus: 0 }, dex: { base: 10, racialBonus: 0 },
      con: { base: 10, racialBonus: 0 }, int: { base: 10, racialBonus: 0 },
      wis: { base: 10, racialBonus: 0 }, cha: { base: 10, racialBonus: 0 }
    },
    combat: {
      hp: { current: 10, max: 10, temp: 0 },
      ac: 10, initiative: 0, speed: 9, hitDice: '1d8',
      hitDiceUsed: 0,
      deathSaves: { successes: [false,false,false], failures: [false,false,false] }
    },
    skills:        { proficient: [], expertise: [] },
    savingThrows:  { proficient: [] },
    resources:     [],
    coins:         { pp: 0, po: 0, pe: 0, pa: 0, pc: 0 },
    inventory: {
      'Equipamentos': [], 'Armas': [], 'Poções': [],
      'Acessórios': [], 'Utilizáveis': []
    },
    spells: {
      /**
       * known  → armazena magias permanentemente aprendidas:
       *   - Mago: magias transcritas no grimório físico
       *   - Bardo/Feiticeiro/Bruxo/Patrulheiro: lista fixa de magias conhecidas
       *   - Outros conjuradores: não utilizado (acesso à lista completa da classe)
       */
      known: [],
      /**
       * prepared → magias selecionadas para uso no dia atual:
       *   - Clérigo/Druida/Paladino: seleção diária da lista da classe
       *   - Mago: seleção diária do array `known` (grimório)
       *   - Bardo/Feiticeiro/Bruxo/Patrulheiro: espelho de `known`
       *     (atualizados juntos via learnSpell/forgetSpell)
       */
      prepared: [],
      slots: {},
    },
    traits:  { personality: '', ideals: '', bonds: '', flaws: '', backstory: '' },
    diary:   { notes: '', campaign: '', allies: '' },
    proficiencies: { armor: '', weapons: '', tools: '', languages: '' },
    features: ''
  });

  let _state = _defaults();

  // ── Attribute helpers ──────────────────────────────────────────────────
  const getTotalAttr = (key) => {
    const a = _state.attributes[key];
    return (a.base + a.racialBonus);
  };
  const getModifier = (key) => Math.floor((getTotalAttr(key) - 10) / 2);

  const getProficiencyBonus = () => {
    const lvl = _state.identity.level || 1;
    return PROF_BY_LEVEL[Math.min(lvl, 20)] || 2;
  };

  const getSkillMod = (skill) => {
    const SKILL_ATTR = {
      acrobatics:'dex', arcana:'int', athletics:'str', deception:'cha',
      history:'int', insight:'wis', intimidation:'cha', investigation:'int',
      medicine:'wis', nature:'int', perception:'wis', performance:'cha',
      persuasion:'cha', religion:'int', 'sleight-of-hand':'dex',
      stealth:'dex', survival:'wis', 'animal-handling':'wis'
    };
    const attr = SKILL_ATTR[skill] || 'str';
    let mod = getModifier(attr);
    if (_state.skills.expertise.includes(skill)) mod += getProficiencyBonus() * 2;
    else if (_state.skills.proficient.includes(skill)) mod += getProficiencyBonus();
    return mod;
  };

  const getSaveMod = (attr) => {
    let mod = getModifier(attr);
    if (_state.savingThrows.proficient.includes(attr)) mod += getProficiencyBonus();
    return mod;
  };

  const getPassivePerception = () => 10 + getSkillMod('perception');
  const getCarryLimit = () => getTotalAttr('str') * 7.5;

  // ── Spell helpers ──────────────────────────────────────────────────────
  const initSpellSlots = () => {
    const classId = _state.identity.classId;
    const level   = _state.identity.level;
    if (!classId) return;
    const slots = getSpellSlots(classId, level);
    const obj = {};
    slots.forEach((max, i) => {
      if (max > 0) obj[String(i+1)] = { max, used: _state.spells?.slots?.[String(i+1)]?.used || 0 };
    });
    if (!_state.spells) _state.spells = { known: [], prepared: [], slots: {} };
    _state.spells.slots = obj;
  };

  const _ensureSpells = () => {
    if (!_state.spells) _state.spells = { known: [], prepared: [], slots: {} };
    if (!Array.isArray(_state.spells.known))    _state.spells.known    = [];
    if (!Array.isArray(_state.spells.prepared)) _state.spells.prepared = [];
    if (!_state.spells.slots) _state.spells.slots = {};
  };

  const useSpellSlot = (level) => {
    const k = String(level);
    if (!_state.spells?.slots?.[k]) return false;
    const s = _state.spells.slots[k];
    if (s.used >= s.max) return false;
    s.used++; save(); return true;
  };

  const restoreSpellSlot = (level) => {
    const k = String(level);
    if (!_state.spells?.slots?.[k]) return;
    _state.spells.slots[k].used = Math.max(0, _state.spells.slots[k].used - 1);
    save();
  };

  const resetSpellSlots = () => {
    Object.values(_state.spells?.slots || {}).forEach(s => s.used = 0);
    save();
  };

  const resetPactSlots = () => {
    if (CASTER_TYPE[_state.identity?.classId] === 'pact') {
      Object.values(_state.spells?.slots || {}).forEach(s => s.used = 0);
      save();
    }
  };

  // ── Spell state mutations ───────────────────────────────────────────────

  /**
   * Prepara uma magia (escolha diária).
   * Para Clérigos/Druidas/Paladinos: adiciona a prepared.
   * Para Mago: adiciona a prepared (deve já estar em known).
   * Para classes known-fixed: irrelevante — use learnSpell.
   */
  const prepareSpell = (spellId) => {
    _ensureSpells();
    if (!_state.spells.prepared.includes(spellId)) {
      _state.spells.prepared.push(spellId);
      save();
    }
  };

  const unprepareSpell = (spellId) => {
    _ensureSpells();
    _state.spells.prepared = _state.spells.prepared.filter(id => id !== spellId);
    save();
  };

  const isSpellPrepared = (spellId) => {
    _ensureSpells();
    return _state.spells.prepared.includes(spellId);
  };

  /**
   * Aprende uma magia permanentemente (grimório do Mago ou troca de known).
   * Para classes known-fixed: adiciona a known E a prepared simultaneamente.
   * Para Mago: adiciona apenas a known (precisa preparar separadamente).
   */
  const learnSpell = (spellId) => {
    _ensureSpells();
    if (!_state.spells.known.includes(spellId)) {
      _state.spells.known.push(spellId);
      // Classes known-fixed: sincroniza prepared com known
      const subtype = CASTER_SUBTYPE[_state.identity?.classId];
      if (subtype === 'known-fixed') {
        if (!_state.spells.prepared.includes(spellId)) {
          _state.spells.prepared.push(spellId);
        }
      }
      save();
    }
  };

  /**
   * Esquece/remove uma magia do grimório ou da lista de conhecidas.
   * Para classes known-fixed: remove de known E de prepared.
   * Para Mago: remove de known; se estiver em prepared, remove também.
   */
  const forgetSpell = (spellId) => {
    _ensureSpells();
    _state.spells.known    = _state.spells.known.filter(id => id !== spellId);
    _state.spells.prepared = _state.spells.prepared.filter(id => id !== spellId);
    save();
  };

  const isSpellKnown = (spellId) => {
    _ensureSpells();
    return _state.spells.known.includes(spellId);
  };

  /**
   * Retorna as magias de subclasse que são "Sempre Preparadas" para o
   * personagem atual. Carrega do class-features.json de forma síncrona
   * (o DataLoader precisa ter sido chamado previamente para cachear).
   * Retorna array de spellIds ou [] se não houver.
   */
  const getAlwaysPreparedSpells = async () => {
    const classId  = _state.identity?.classId;
    const subclass = _state.identity?.subclass;
    if (!classId || !subclass) return [];
    try {
      const db = await DataLoader.load('./data/class-features.json');
      return db?.[classId]?.subclasses?.[subclass]?.alwaysPrepared || [];
    } catch { return []; }
  };

  // ── Level Up ─────────────────────────────────────────────────────────────
  const levelUp = async (hpMode = 'average', manualHpValue = 0) => {
    const state    = _state;
    const classId  = state.identity.classId;
    const curLevel = state.identity.level || 1;
    const newLevel = Math.min(curLevel + 1, 20);
    if (newLevel === curLevel) return false;

    const hitDieSides = HIT_DIE_BY_CLASS[classId]
      || parseInt((state.combat?.hitDice || '1d8').replace(/^\d*d/, ''))
      || 8;
    const conMod = getModifier('con');

    let hpGain;
    if (hpMode === 'manual') {
      hpGain = Math.max(1, (parseInt(manualHpValue) || 1) + conMod);
    } else if (hpMode === 'virtual') {
      const rolled = Math.floor(Math.random() * hitDieSides) + 1;
      hpGain = Math.max(1, rolled + conMod);
    } else {
      hpGain = Math.max(1, Math.floor(hitDieSides / 2) + 1 + conMod);
    }

    const newMax   = state.combat.hp.max + hpGain;
    const newCur   = state.combat.hp.current + hpGain;
    const newProf  = PROF_BY_LEVEL[newLevel];
    const newHitDice = `${newLevel}d${hitDieSides}`;

    let newFeatureText = '';
    try {
      const db = await DataLoader.load('./data/class-features.json');
      const classData = db?.[classId];
      if (classData) {
        const lvlData = classData[String(newLevel)];
        const feats = lvlData?.features?.filter(f => f && f.trim()) || [];
        if (feats.length) {
          newFeatureText = `[Nível ${newLevel}] ${feats.join(', ')}`;
        }
      }
    } catch(e) {
      console.warn('class-features.json load failed:', e);
    }

    const existingFeatures = state.features || '';
    const updatedFeatures = newFeatureText
      ? existingFeatures + (existingFeatures ? '\n' : '') + newFeatureText
      : existingFeatures;

    const asiLevels = ASI_LEVELS[classId] || [4, 8, 12, 16, 19];
    const needsASI  = asiLevels.includes(newLevel);

    state.identity.level    = newLevel;
    state.combat.hp.max     = newMax;
    state.combat.hp.current = Math.min(newCur, newMax);
    state.combat.hitDice    = newHitDice;
    state.features          = updatedFeatures;

    initSpellSlots();
    save();

    return { newLevel, hpGain, newProf, featureText: newFeatureText, needsASI };
  };

  // ── CA Recalc ─────────────────────────────────────────────────────────────
  const recalcAC = () => {
    const dexMod = getModifier('dex');
    const strMod = getModifier('str');
    const classId = _state.identity.classId;

    const equipItems = _state.inventory?.['Equipamentos'] || [];
    const armour  = equipItems.find(i => i.status === 'Equipado' && i.type === 'Armadura');
    const shield  = equipItems.find(i => i.status === 'Equipado' && i.type === 'Escudo');
    const shieldBonus = shield ? 2 : 0;

    let ac;
    if (!armour) {
      if (classId === 'barbarian') ac = 10 + dexMod + strMod;
      else if (classId === 'monk') ac = 10 + dexMod + getModifier('wis');
      else ac = 10 + dexMod;
    } else {
      const base = parseInt(armour.aBaseAC) || 10;
      const tipo = armour.aType || 'light';
      if (tipo === 'heavy') ac = base;
      else if (tipo === 'medium') ac = base + Math.min(dexMod, 2);
      else ac = base + dexMod;
    }

    ac += shieldBonus;
    _state.combat.ac = ac;
    save(); return ac;
  };

  // ── Equipped weapons → attacks ────────────────────────────────────────────
  const getEquippedAttacks = () => {
    const weapons = (_state.inventory?.['Armas'] || []).filter(i => i.status === 'Equipado');
    const profBonus = getProficiencyBonus();
    const strMod = getModifier('str');
    const dexMod = getModifier('dex');
    return weapons.slice(0, 3).map(w => {
      const isFinesse = (w.wProps || '').toLowerCase().includes('finesse');
      const isRanged  = (w.wRange || '') === 'Longa distância';
      let attrMod = isRanged ? dexMod : (isFinesse ? Math.max(strMod, dexMod) : strMod);
      const atkBonus = attrMod + profBonus + (parseInt(w.wAtk) || 0);
      return {
        name:   w.name,
        bonus:  atkBonus >= 0 ? `+${atkBonus}` : `${atkBonus}`,
        damage: `${w.wDice || '—'} ${w.wDmgType || ''}`.trim(),
        props:  w.wProps || ''
      };
    });
  };

  // ── Persistence ────────────────────────────────────────────────────────────
  const save = () => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(_state)); } catch(e) {}
  };

  const load = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);

      // 1. Sanitização estrutural de Magias ANTES do deepMerge
      if (parsed.spells) {
        if (Array.isArray(parsed.spells)) {
          // Converte o Array antigo para o novo formato de Objeto
          parsed.spells = {
            known: [],
            prepared: parsed.spells,
            slots: {}
          };
        } else if (!parsed.spells.prepared) {
          // Fallback caso seja um objeto sem a chave obrigatória
          parsed.spells = { known: [], prepared: [], slots: {} };
        }
      }

      // 2. Aplicação do estado com a estrutura já sanitizada
      _state = deepMerge(_defaults(), parsed);

      // 3. Execução das lógicas de migração de versão v4→v5
      if (!_state.spells.known || !Array.isArray(_state.spells.known)) {
        _state.spells.known = [];
      }

      if (!_state.meta) _state.meta = { version: 1 }; // Prevenção contra ausência do nó meta

      if (_state.meta.version < 5) {
        // Validação adicional para evitar quebra caso identity ou classId sejam undefined
        const classId = _state.identity ? _state.identity.classId : null;
        
        if (classId && typeof CASTER_SUBTYPE !== 'undefined') {
          const subtype = CASTER_SUBTYPE[classId];
          if (subtype === 'known-fixed' && Array.isArray(_state.spells.prepared) && _state.spells.prepared.length > 0) {
            _state.spells.known = [..._state.spells.prepared];
          }
        }
        _state.meta.version = 5;
      }
      return true; // ← dados carregados com sucesso
    }
  } catch(e) { 
    console.warn('CharacterState.load error:', e); 
  }
  return false; // ← sem dados salvos ou erro
  };

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(_state, null, 2)], { type:'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = `${_state.identity.name || 'personagem'}_sheet.json`;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  const importJSON = (jsonString) => {
    try { _state = deepMerge(_defaults(), JSON.parse(jsonString)); save(); return true; }
    catch(e) { return false; }
  };

  const reset  = () => { _state = _defaults(); save(); };
  const get    = () => _state;
  const set    = (path, value) => { setNestedValue(_state, path, value); save(); };
  const patch  = (partialState) => { _state = deepMerge(_state, partialState); save(); };

  // ── Inventory CRUD ─────────────────────────────────────────────────────────
  const CATEGORIES = ['Equipamentos','Armas','Poções','Acessórios','Utilizáveis'];
  const SLOTS_MAX  = 50;

  const _ensureCategories = () => {
    if (!_state.inventory || Array.isArray(_state.inventory)) {
      _state.inventory = { 'Equipamentos':[],'Armas':[],'Poções':[],'Acessórios':[],'Utilizáveis':[] };
    }
    CATEGORIES.forEach(c => { if (!_state.inventory[c]) _state.inventory[c] = []; });
  };

  const getItemsByCategory = (cat) => { _ensureCategories(); return _state.inventory[cat] || []; };

  const addItem = (cat, item) => {
    _ensureCategories();
    if (!CATEGORIES.includes(cat)) return null;
    const list = _state.inventory[cat];
    if (list.length >= SLOTS_MAX) return null;
    const newItem = {
      id: `item_${Date.now()}_${Math.random().toString(36).slice(2,7)}`,
      name: item.name||'Item', type: item.type||'Outros',
      qty: parseInt(item.qty)||1, status: item.status||'Normal',
      desc: item.desc||'', img: item.img||null,
      weight: parseFloat(item.weight)||0,
      wDmgType: item.wDmgType||'', wDice: item.wDice||'',
      wRange: item.wRange||'', wAtk: item.wAtk||'', wProps: item.wProps||'',
      aBaseAC: item.aBaseAC || null,
      aType: item.aType || null
    };
    list.push(newItem); save(); return newItem;
  };

  const updateItem = (cat, id, updates, newCat) => {
    _ensureCategories();
    const list = _state.inventory[cat];
    const idx  = list.findIndex(i => i.id === id);
    if (idx === -1) return false;
    const merged = { ...list[idx], ...updates };
    merged.qty = parseInt(merged.qty) || 1;
    if (newCat && newCat !== cat && CATEGORIES.includes(newCat)) {
      if (_state.inventory[newCat].length >= SLOTS_MAX) return false;
      list.splice(idx, 1);
      _state.inventory[newCat].push(merged);
    } else { list[idx] = merged; }
    save(); return true;
  };

  const deleteItem = (cat, id) => {
    _ensureCategories();
    const list = _state.inventory[cat];
    const idx  = list.findIndex(i => i.id === id);
    if (idx === -1) return false;
    list.splice(idx, 1); save(); return true;
  };

  const getTotalWeight = () => {
    _ensureCategories();
    return CATEGORIES.reduce((sum, cat) =>
      sum + _state.inventory[cat].reduce((s, item) =>
        s + ((parseFloat(item.weight)||0) * (item.qty||1)), 0), 0);
  };

  // ── Coins ──────────────────────────────────────────────────────────────────
  const TO_PO = { pp:10, po:1, pe:0.5, pa:0.1, pc:0.01 };

  const updateCoins = (key, delta) => {
    if (!_state.coins) _state.coins = { pp:0,po:0,pe:0,pa:0,pc:0 };
    _state.coins[key] = Math.max(0, (_state.coins[key]||0) + delta);
    save(); return _state.coins[key];
  };

  const setCoins = (key, value) => {
    if (!_state.coins) _state.coins = { pp:0,po:0,pe:0,pa:0,pc:0 };
    _state.coins[key] = Math.max(0, parseInt(value)||0);
    save();
  };

  const getTotalPO = () => {
    const c = _state.coins || {};
    return Object.keys(TO_PO).reduce((s,k) => s+(c[k]||0)*TO_PO[k], 0);
  };

  return {
    get, set, patch, save, load, reset, exportJSON, importJSON,
    getTotalAttr, getModifier, getProficiencyBonus,
    getSkillMod, getSaveMod, getPassivePerception, getCarryLimit,
    addItem, updateItem, deleteItem, getTotalWeight,
    getItemsByCategory, CATEGORIES, SLOTS_MAX,
    updateCoins, setCoins, getTotalPO,
    // Spell API refatorada
    prepareSpell, unprepareSpell, isSpellPrepared,
    learnSpell, forgetSpell, isSpellKnown,
    getAlwaysPreparedSpells,
    initSpellSlots, useSpellSlot, restoreSpellSlot, resetSpellSlots, resetPactSlots,
    levelUp, recalcAC, getEquippedAttacks
  };
})();

// ══════════════════════════════════════════════════════════════════════════════
// Utilities
// ══════════════════════════════════════════════════════════════════════════════
function deepMerge(target, source) {
  const output = Object.assign({}, target);
  if (isObject(target) && isObject(source)) {
    Object.keys(source).forEach(key => {
      if (Array.isArray(source[key])) {
        output[key] = source[key];
      } else if (isObject(source[key])) {
        if (!(key in target)) Object.assign(output, { [key]: source[key] });
        else output[key] = deepMerge(target[key], source[key]);
      } else { Object.assign(output, { [key]: source[key] }); }
    });
  }
  return output;
}
function isObject(item) { return item && typeof item === 'object' && !Array.isArray(item); }
function setNestedValue(obj, path, value) {
  const keys = path.split('.');
  let cur = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    if (!(keys[i] in cur)) cur[keys[i]] = {};
    cur = cur[keys[i]];
  }
  cur[keys[keys.length - 1]] = value;
}

// ══════════════════════════════════════════════════════════════════════════════
// Router
// ══════════════════════════════════════════════════════════════════════════════
export const Router = (() => {
  const _views = {};
  let _current = null;
  const register = (name, el) => { _views[name] = el; };
  const navigate = (name, params = {}) => {
    Object.values(_views).forEach(v => v.classList.remove('active'));
    if (_views[name]) {
      _views[name].classList.add('active');
      _current = name;
      window.dispatchEvent(new CustomEvent('route-change', { detail: { view: name, params } }));
    }
  };
  const current = () => _current;
  return { register, navigate, current };
})();

// ══════════════════════════════════════════════════════════════════════════════
// Toast
// ══════════════════════════════════════════════════════════════════════════════
export const Toast = (() => {
  const show = (msg, duration = 3500) => {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = msg;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), duration);
  };
  return { show };
})();

// ══════════════════════════════════════════════════════════════════════════════
// DataLoader
// ══════════════════════════════════════════════════════════════════════════════
export const DataLoader = (() => {
  const _cache = {};
  const load = async (path) => {
    if (_cache[path]) return _cache[path];
    try {
      const res = await fetch(path);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      _cache[path] = data; return data;
    } catch(e) { console.error(`DataLoader: failed to load ${path}`, e); return null; }
  };
  return { load };
})();

// ══════════════════════════════════════════════════════════════════════════════
// Formatters
// ══════════════════════════════════════════════════════════════════════════════
export const fmt = {
  modifier:  (n) => n >= 0 ? `+${n}` : `${n}`,
  signedNum: (n) => n >= 0 ? `+${n}` : `${n}`
};

// ══════════════════════════════════════════════════════════════════════════════
// ThemeManager
// ══════════════════════════════════════════════════════════════════════════════
export const ThemeManager = (() => {
  const STORAGE_KEY = 'rpg_active_theme';
  const DEFAULT     = 'dark';
  const THEMES = [
    { id: 'dark',      label: 'Codex Sombrio',     icon: '☽' },
    { id: 'emerald',   label: 'Floresta Esmeralda', icon: '🌿' },
    { id: 'frost',     label: 'Pico Gelado',        icon: '❄' },
    { id: 'infernal',  label: 'Abismo Infernal',    icon: '🔥' },
    { id: 'parchment', label: 'Pergaminho Antigo',  icon: '📜' },
  ];
  const setTheme = (id) => {
    document.documentElement.setAttribute('data-theme', id);
    localStorage.setItem(STORAGE_KEY, id);
    window.dispatchEvent(new CustomEvent('theme-change', { detail: { theme: id } }));
  };
  const getTheme = () => localStorage.getItem(STORAGE_KEY) || DEFAULT;
  const init     = () => setTheme(getTheme());
  const getAll   = () => THEMES;
  return { init, setTheme, getTheme, getAll };
})();

// ══════════════════════════════════════════════════════════════════════════════
// DiceRoller FAB — Hybrid: virtual RNG + manual physical input
// ══════════════════════════════════════════════════════════════════════════════
export const DiceRoller = (() => {
  const DICE = [4, 6, 8, 10, 12, 20, 100];
  const rollVirtual = (sides) => Math.floor(Math.random() * sides) + 1;

  const init = () => {
    if (document.getElementById('dice-fab')) return;

    const fab = document.createElement('button');
    fab.id = 'dice-fab'; fab.className = 'dice-fab'; fab.title = 'Rolar Dado';
    fab.innerHTML = '🎲';
    document.body.appendChild(fab);

    const menu = document.createElement('div');
    menu.id = 'dice-menu'; menu.className = 'dice-menu';
    menu.innerHTML = DICE.map(d =>
      `<button class="dice-btn" data-sides="${d}">d${d}</button>`
    ).join('');
    document.body.appendChild(menu);

    const overlay = document.createElement('div');
    overlay.id = 'dice-overlay'; overlay.className = 'dice-overlay';
    overlay.innerHTML = `
      <div class="dice-result-box" id="dice-result-box">
        <div class="dice-result-die" id="dice-result-die">d20</div>
        <div class="dice-result-num" id="dice-result-num">—</div>
        <div class="dice-hybrid-tabs" id="dice-hybrid-tabs">
          <button class="dice-tab-btn active" data-mode="virtual">🎲 Virtual</button>
          <button class="dice-tab-btn" data-mode="manual">✍ Físico</button>
        </div>
        <div id="dice-virtual-panel">
          <button class="btn btn-secondary btn-sm" id="dice-reroll">Rolar Virtualmente</button>
        </div>
        <div id="dice-manual-panel" style="display:none">
          <div style="display:flex;align-items:center;gap:0.5rem;justify-content:center;margin-bottom:0.5rem">
            <input type="number" id="dice-manual-input" class="form-control"
              style="width:80px;text-align:center;font-size:1.1rem"
              placeholder="—" min="1">
            <button class="btn btn-secondary btn-sm" id="dice-manual-confirm">Confirmar</button>
          </div>
          <div style="font-size:0.75rem;color:var(--text-dim)">
            Digite o valor do seu dado físico
          </div>
        </div>
        <div class="dice-history" id="dice-history"></div>
        <button class="btn btn-ghost btn-sm" id="dice-close" style="margin-top:0.5rem">Fechar</button>
      </div>`;
    document.body.appendChild(overlay);

    let currentSides = 20;
    let currentMode  = 'virtual';
    const history    = [];

    const _pushHistory = (sides, value, source) => {
      history.unshift({ sides, value, source, ts: new Date().toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' }) });
      if (history.length > 5) history.pop();
      _refreshHistory();
    };

    const _refreshHistory = () => {
      const el = document.getElementById('dice-history');
      if (!el) return;
      el.innerHTML = history.length === 0 ? '' :
        `<div class="dice-hist-title">Histórico</div>` +
        history.map(h =>
          `<div class="dice-hist-row">
             <span class="dice-hist-die">d${h.sides}</span>
             <span class="dice-hist-val" style="color:${h.value===h.sides?'var(--gold-bright)':h.value===1?'var(--crimson-bright)':'var(--text-primary)'}">${h.value}</span>
             <span class="dice-hist-src">${h.source}</span>
             <span class="dice-hist-ts">${h.ts}</span>
           </div>`
        ).join('');
    };

    const _showResult = (sides, value, source = 'Virtual') => {
      const overlayEl = document.getElementById('dice-overlay');
      const numEl     = document.getElementById('dice-result-num');
      const dieEl     = document.getElementById('dice-result-die');
      if (!overlayEl) return;
      dieEl.textContent = `d${sides}`;
      numEl.textContent  = value;
      numEl.style.color  = value === sides ? 'var(--gold-bright)'
                         : value === 1     ? 'var(--crimson-bright)'
                         : 'var(--text-primary)';
      _pushHistory(sides, value, source);
      overlayEl.classList.add('open');
    };

    const _setMode = (mode) => {
      currentMode = mode;
      overlay.querySelectorAll('.dice-tab-btn').forEach(b =>
        b.classList.toggle('active', b.dataset.mode === mode));
      document.getElementById('dice-virtual-panel').style.display = mode === 'virtual' ? '' : 'none';
      document.getElementById('dice-manual-panel').style.display  = mode === 'manual'  ? '' : 'none';
      if (mode === 'manual') {
        const inp = document.getElementById('dice-manual-input');
        inp.max   = currentSides;
        inp.value = '';
        inp.focus();
      }
    };

    fab.addEventListener('click', (e) => {
      e.stopPropagation(); menu.classList.toggle('open');
    });

    menu.querySelectorAll('.dice-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        currentSides = parseInt(btn.dataset.sides);
        menu.classList.remove('open');
        const inp = document.getElementById('dice-manual-input');
        if (inp) inp.max = currentSides;
        if (currentMode === 'virtual') {
          _showResult(currentSides, rollVirtual(currentSides), 'Virtual');
        } else {
          overlay.classList.add('open');
          document.getElementById('dice-result-die').textContent = `d${currentSides}`;
        }
      });
    });

    overlay.querySelectorAll('.dice-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => _setMode(btn.dataset.mode));
    });

    document.getElementById('dice-reroll')?.addEventListener('click', () => {
      _showResult(currentSides, rollVirtual(currentSides), 'Virtual');
    });

    document.getElementById('dice-manual-confirm')?.addEventListener('click', () => {
      const inp = document.getElementById('dice-manual-input');
      const val = parseInt(inp?.value);
      if (!val || val < 1 || val > currentSides) {
        Toast.show(`⚠ Valor inválido para d${currentSides} (1–${currentSides})`); return;
      }
      _showResult(currentSides, val, 'Físico');
      inp.value = '';
    });

    document.getElementById('dice-manual-input')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') document.getElementById('dice-manual-confirm')?.click();
    });

    document.getElementById('dice-close')?.addEventListener('click', () => {
      overlay.classList.remove('open');
    });
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.classList.remove('open');
    });
    document.addEventListener('click', (e) => {
      if (!menu.contains(e.target) && e.target !== fab) menu.classList.remove('open');
    });
  };

  return { init };
})();