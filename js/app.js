/**
 * app.js — Core: State Management, Routing, Persistence
 * Versão 4 — Async LevelUp, Hybrid Dice Roller, JSON-driven class features
 */

// ══════════════════════════════════════════════════════════════════════════════
// TABELAS D&D 5e (PHB)
// ══════════════════════════════════════════════════════════════════════════════

/** Bónus de Proficiência por nível */
export const PROF_BY_LEVEL = [0,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,6,6,6,6];

/** Spell slots por classe e nível (full-casters) */
const SPELL_SLOTS_FULL = [
// nv  1  2  3  4  5  6  7  8  9
  [], // 0
  [4,0,0,0,0,0,0,0,0],  // 1
  [3,2,0,0,0,0,0,0,0],  // 2
  [4,2,2,0,0,0,0,0,0],  // 3
  [4,3,2,0,0,0,0,0,0],  // 4
  [4,3,2,2,0,0,0,0,0],  // 5
  [4,3,3,2,0,0,0,0,0],  // 6
  [4,3,3,2,1,0,0,0,0],  // 7
  [4,3,3,3,1,0,0,0,0],  // 8
  [4,3,3,3,2,0,0,0,0],  // 9
  [4,3,3,3,2,1,0,0,0],  // 10
  [4,3,3,3,2,1,0,0,0],  // 11
  [4,3,3,3,2,1,1,0,0],  // 12
  [4,3,3,3,2,1,1,0,0],  // 13
  [4,3,3,3,2,1,1,1,0],  // 14
  [4,3,3,3,2,1,1,1,0],  // 15
  [4,3,3,3,2,1,1,1,1],  // 16
  [4,3,3,3,2,1,1,1,1],  // 17
  [4,3,3,3,3,1,1,1,1],  // 18
  [4,3,3,3,3,2,1,1,1],  // 19
  [4,3,3,3,3,2,2,1,1],  // 20
];
const SPELL_SLOTS_HALF = [
  [], [],
  [2,0,0,0,0,0,0,0,0],  // 2
  [3,0,0,0,0,0,0,0,0],  // 3
  [3,2,0,0,0,0,0,0,0],  // 4
  [4,2,0,0,0,0,0,0,0],  // 5
  [4,2,2,0,0,0,0,0,0],  // 6
  [4,3,2,0,0,0,0,0,0],  // 7
  [4,3,2,0,0,0,0,0,0],  // 8
  [4,3,2,2,0,0,0,0,0],  // 9
  [4,3,2,2,0,0,0,0,0],  // 10
  [4,3,3,2,0,0,0,0,0],  // 11
  [4,3,3,2,0,0,0,0,0],  // 12
  [4,3,3,2,2,0,0,0,0],  // 13
  [4,3,3,2,2,0,0,0,0],  // 14
  [4,3,3,2,2,2,0,0,0],  // 15
  [4,3,3,2,2,2,0,0,0],  // 16
  [4,3,3,3,2,2,0,0,0],  // 17
  [4,3,3,3,2,2,0,0,0],  // 18
  [4,3,3,3,2,2,2,0,0],  // 19
  [4,3,3,3,3,2,2,0,0],  // 20
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

/** Tipo de conjurador por classe */
export const CASTER_TYPE = {
  bard:'full', cleric:'full', druid:'full', sorcerer:'full', wizard:'full',
  warlock:'pact', // Magia de Pacto — slots únicos recuperados em descanso curto
  paladin:'half', ranger:'half',
  barbarian:'none', fighter:'none', monk:'none', rogue:'none'
};

/** Atributo de conjuração por classe */
export const CASTING_ATTR = {
  bard:'cha', cleric:'wis', druid:'wis', sorcerer:'cha', wizard:'int',
  warlock:'cha', paladin:'cha', ranger:'wis'
};

/**
 * Dado de vida canônico por classe (PHB).
 * Usado no levelUp como fonte de verdade, ignorando o campo editável hitDice.
 */
export const HIT_DIE_BY_CLASS = {
  barbarian: 12,
  fighter: 10, paladin: 10, ranger: 10,
  bard: 8, cleric: 8, druid: 8, monk: 8, rogue: 8, warlock: 8,
  sorcerer: 6, wizard: 6
};

/**
 * Níveis de ASI por classe (Aumento de Valor de Habilidade).
 * Guerreiro tem o maior número; Ladino ganha um extra no nível 10.
 */
const ASI_LEVELS = {
  barbarian: [4, 8, 12, 16, 19],
  bard:      [4, 8, 12, 16, 19],
  cleric:    [4, 8, 12, 16, 19],
  druid:     [4, 8, 12, 16, 19],
  fighter:   [4, 6, 8, 12, 14, 16, 19], // extra ASIs
  monk:      [4, 8, 12, 16, 19],
  paladin:   [4, 8, 12, 16, 19],
  ranger:    [4, 8, 12, 16, 19],
  rogue:     [4, 8, 10, 12, 16, 19],    // extra ASI at 10
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
    // Retorna array de 9 posições; apenas o nível do pacto tem slots
    const result = [0,0,0,0,0,0,0,0,0];
    result[entry[1] - 1] = entry[0];
    return result;
  }
  const table = type === 'half' ? SPELL_SLOTS_HALF : SPELL_SLOTS_FULL;
  return table[Math.min(level, 20)] || [];
}

/** Retorna número máximo de magias preparadas */
export function getMaxPrepared(classId, level, castingAttrMod) {
  const spellcastingClasses = ['cleric','druid','paladin','ranger','wizard','bard','sorcerer','warlock'];
  if (!spellcastingClasses.includes(classId)) return 0;
  if (['bard','sorcerer','warlock'].includes(classId)) return null; // known spells
  if (classId === 'wizard') return Math.max(1, level + castingAttrMod);
  if (['cleric','druid'].includes(classId)) return Math.max(1, level + castingAttrMod);
  if (['paladin','ranger'].includes(classId)) return Math.max(1, Math.floor(level/2) + castingAttrMod);
  return null;
}

// ══════════════════════════════════════════════════════════════════════════════
// CharacterState
// ══════════════════════════════════════════════════════════════════════════════
export const CharacterState = (() => {
  const STORAGE_KEY = 'rpg_character_sheet_v1';

  const _defaults = () => ({
    meta: { createdAt: new Date().toISOString(), version: 4 },
    identity: {
      name: '', race: '', raceId: '', class: '', classId: '', level: 1,
      background: '', alignment: '', xp: 0, playerName: ''
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
    if (!_state.spells) _state.spells = { prepared: [], slots: {} };
    _state.spells.slots = obj;
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

  // Warlock recupera slots de pacto em descanso CURTO
  const resetPactSlots = () => {
    if (CASTER_TYPE[_state.identity?.classId] === 'pact') {
      Object.values(_state.spells?.slots || {}).forEach(s => s.used = 0);
      save();
    }
  };

  // ── Level Up (async, hybrid HP mode) ─────────────────────────────────
  /**
   * @param {'average'|'virtual'|'manual'} hpMode
   * @param {number} manualHpValue  — used only when hpMode === 'manual'
   * @returns {Promise<false|{newLevel, hpGain, newProf, features, needsASI}>}
   */
  const levelUp = async (hpMode = 'average', manualHpValue = 0) => {
    const state    = _state;
    const classId  = state.identity.classId;
    const curLevel = state.identity.level || 1;
    const newLevel = Math.min(curLevel + 1, 20);
    if (newLevel === curLevel) return false;

    // Hit die sides — usa tabela canônica da classe como fonte de verdade;
    // cai para o campo hitDice do state como fallback (fichas importadas)
    const hitDieSides = HIT_DIE_BY_CLASS[classId]
      || parseInt((state.combat?.hitDice || '1d8').replace(/^\d*d/, ''))
      || 8;
    const conMod     = getModifier('con');

    // HP gain
    let hpGain;
    if (hpMode === 'manual') {
      hpGain = Math.max(1, (parseInt(manualHpValue) || 1) + conMod);
    } else if (hpMode === 'virtual') {
      const rolled = Math.floor(Math.random() * hitDieSides) + 1;
      hpGain = Math.max(1, rolled + conMod);
    } else {
      // average: floor(sides/2)+1 + CON
      hpGain = Math.max(1, Math.floor(hitDieSides / 2) + 1 + conMod);
    }

    const newMax = state.combat.hp.max + hpGain;
    const newCur = state.combat.hp.current + hpGain;
    const newProf = PROF_BY_LEVEL[newLevel];
    const newHitDice = `${newLevel}d${hitDieSides}`;

    // Load features from JSON
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

    // ASI detection
    const asiLevels = ASI_LEVELS[classId] || [4, 8, 12, 16, 19];
    const needsASI  = asiLevels.includes(newLevel);

    // Commit
    state.identity.level    = newLevel;
    state.combat.hp.max     = newMax;
    state.combat.hp.current = Math.min(newCur, newMax);
    state.combat.hitDice    = newHitDice;
    state.features          = updatedFeatures;

    initSpellSlots();
    save();

    return { newLevel, hpGain, newProf, featureText: newFeatureText, needsASI };
  };

  // ── CA Recalc ─────────────────────────────────────────────────────────
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
      if (classId === 'barbarian') {
        ac = 10 + dexMod + strMod;
      } else if (classId === 'monk') {
        ac = 10 + dexMod + getModifier('wis');
      } else {
        ac = 10 + dexMod;
      }
    } else {
      // CÁLCULO SEGURO VIA PROPRIEDADES FIXAS
      const base = parseInt(armour.aBaseAC) || 10;
      const tipo = armour.aType || 'light';
      
      if (tipo === 'heavy') {
        ac = base;
      } else if (tipo === 'medium') {
        ac = base + Math.min(dexMod, 2);
      } else {
        ac = base + dexMod; // light ou fallback
      }
    }

    ac += shieldBonus;
    _state.combat.ac = ac;
    save(); return ac;
  };

  // ── Equipped weapons → attacks ─────────────────────────────────────────
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

  // ── Persistence ────────────────────────────────────────────────────────
  const save = () => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(_state)); }
    catch(e) { console.warn('State save failed:', e); }
  };

  const load = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) { _state = deepMerge(_defaults(), JSON.parse(raw)); return true; }
    } catch(e) { console.warn('State load failed:', e); }
    return false;
  };

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(_state, null, 2)], { type: 'application/json' });
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

  // ── Inventory CRUD ────────────────────────────────────────────────────
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
      aBaseAC: item.aBaseAC || null, // <- NOVA LINHA
      aType: item.aType || null      // <- NOVA LINHA
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

  // ── Coins ──────────────────────────────────────────────────────────────
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

  // ── Spells ────────────────────────────────────────────────────────────
  const prepareSpell = (spellId) => {
    if (!_state.spells.prepared.includes(spellId)) {
      _state.spells.prepared.push(spellId); save();
    }
  };
  const unprepareSpell = (spellId) => {
    _state.spells.prepared = _state.spells.prepared.filter(id => id !== spellId);
    save();
  };
  const isSpellPrepared = (spellId) => _state.spells.prepared.includes(spellId);

  return {
    get, set, patch, save, load, reset, exportJSON, importJSON,
    getTotalAttr, getModifier, getProficiencyBonus,
    getSkillMod, getSaveMod, getPassivePerception, getCarryLimit,
    addItem, updateItem, deleteItem, getTotalWeight,
    getItemsByCategory, CATEGORIES, SLOTS_MAX,
    updateCoins, setCoins, getTotalPO,
    prepareSpell, unprepareSpell, isSpellPrepared,
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
        // Arrays are always replaced wholesale — never recursively merged
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

    // ── FAB button ─────────────────────────────────────────────────────
    const fab = document.createElement('button');
    fab.id = 'dice-fab'; fab.className = 'dice-fab'; fab.title = 'Rolar Dado';
    fab.innerHTML = '🎲';
    document.body.appendChild(fab);

    // ── Dice selection menu ────────────────────────────────────────────
    const menu = document.createElement('div');
    menu.id = 'dice-menu'; menu.className = 'dice-menu';
    menu.innerHTML = DICE.map(d =>
      `<button class="dice-btn" data-sides="${d}">d${d}</button>`
    ).join('');
    document.body.appendChild(menu);

    // ── Result overlay (hybrid) ────────────────────────────────────────
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
    let currentMode  = 'virtual'; // 'virtual' | 'manual'
    const history    = [];

    // ── Helpers ────────────────────────────────────────────────────────
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
      const overlay = document.getElementById('dice-overlay');
      const numEl   = document.getElementById('dice-result-num');
      const dieEl   = document.getElementById('dice-result-die');
      if (!overlay) return;
      dieEl.textContent = `d${sides}`;
      numEl.textContent  = value;
      numEl.style.color  = value === sides ? 'var(--gold-bright)'
                         : value === 1     ? 'var(--crimson-bright)'
                         : 'var(--text-primary)';
      _pushHistory(sides, value, source);
      overlay.classList.add('open');
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

    // ── FAB → menu ─────────────────────────────────────────────────────
    fab.addEventListener('click', (e) => {
      e.stopPropagation(); menu.classList.toggle('open');
    });

    menu.querySelectorAll('.dice-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        currentSides = parseInt(btn.dataset.sides);
        menu.classList.remove('open');
        // Update manual input max
        const inp = document.getElementById('dice-manual-input');
        if (inp) inp.max = currentSides;
        // Auto-roll virtual on selection
        if (currentMode === 'virtual') {
          _showResult(currentSides, rollVirtual(currentSides), 'Virtual');
        } else {
          overlay.classList.add('open');
          document.getElementById('dice-result-die').textContent = `d${currentSides}`;
        }
      });
    });

    // ── Hybrid tabs ─────────────────────────────────────────────────────
    overlay.querySelectorAll('.dice-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => _setMode(btn.dataset.mode));
    });

    // ── Virtual re-roll ────────────────────────────────────────────────
    document.getElementById('dice-reroll')?.addEventListener('click', () => {
      _showResult(currentSides, rollVirtual(currentSides), 'Virtual');
    });

    // ── Manual confirm ─────────────────────────────────────────────────
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

    // ── Close / outside click ──────────────────────────────────────────
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
