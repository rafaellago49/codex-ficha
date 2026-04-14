/**
 * app.js — Core: State Management, Routing, Persistence
 * Module Pattern — Vanilla ES6
 */

// ── CharacterState ──────────────────────────────────────────────────────────
export const CharacterState = (() => {
  const STORAGE_KEY = 'rpg_character_sheet_v1';

  const _defaults = () => ({
    meta: { createdAt: new Date().toISOString(), version: 2 },
    identity: {
      name: '', race: '', raceId: '', class: '', level: 1,
      background: '', alignment: '', xp: 0, playerName: ''
    },
    attributes: {
      str: { base: 10, racialBonus: 0 }, dex: { base: 10, racialBonus: 0 },
      con: { base: 10, racialBonus: 0 }, int: { base: 10, racialBonus: 0 },
      wis: { base: 10, racialBonus: 0 }, cha: { base: 10, racialBonus: 0 }
    },
    combat: {
      hp: { current: 10, max: 10, temp: 0 }, ac: 10, initiative: 0,
      speed: 9, hitDice: '1d8',
      hitDicePool: { total: 1, spent: 0, die: 8 },
      passivePerception: 10,
      deathSaves: { successes: [false,false,false], failures: [false,false,false] }
    },
    skills:        { proficient: [], expertise: [] },
    savingThrows:  { proficient: [] },
    resources:     [],
    coins:         { pp: 0, po: 0, pe: 0, pa: 0, pc: 0 },
    inventory: {
      'Equipamentos': [],
      'Armas':        [],
      'Poções':       [],
      'Acessórios':   [],
      'Utilizáveis':  []
    },
    spells:  { prepared: [], slots: {}, casting: { ability: null, progression: 'none', pactLevel: 0 } },
    traits:  { personality: '', ideals: '', bonds: '', flaws: '', backstory: '' },
    diary:   { notes: '', campaign: '', allies: '' },
    proficiencies: { armor: '', weapons: '', tools: '', languages: '' },
    features: [],
    progression: {
      classId: '',
      hitDie: 8,
      attacks: []
    }
  });

  let _state = _defaults();

  // ── Attribute helpers ──
  const getTotalAttr = (key) => {
    const a = _state.attributes[key];
    return (a.base + a.racialBonus);
  };

  const getModifier = (key) => {
    const total = getTotalAttr(key);
    return Math.floor((total - 10) / 2);
  };

  const getProficiencyBonus = () => {
    const lvl = _state.identity.level || 1;
    return Math.ceil(lvl / 4) + 1; // 1-4:+2, 5-8:+3, 9-12:+4, 13-16:+5, 17-20:+6
  };

  const getSkillMod = (skill) => {
    const SKILL_ATTR = {
      acrobatics: 'dex', arcana: 'int', athletics: 'str',
      deception: 'cha', history: 'int', insight: 'wis',
      intimidation: 'cha', investigation: 'int', medicine: 'wis',
      nature: 'int', perception: 'wis', performance: 'cha',
      persuasion: 'cha', religion: 'int', 'sleight-of-hand': 'dex',
      stealth: 'dex', survival: 'wis', 'animal-handling': 'wis'
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

  const getCarryCapacity = () => {
    const str = getTotalAttr('str');
    return Math.round(str * 7.5 * 10) / 10;
  };

  const getEquippedItems = () => {
    _ensureCategories();
    return CATEGORIES.flatMap(cat => _state.inventory[cat]).filter(i => i?.equipped);
  };

  const getEquippedWeapons = () => getItemsByCategory('Armas').filter(i => i.equipped);

  const _parseArmorInfo = (item = {}) => {
    const text = `${item.desc || ''} ${item.name || ''}`.toLowerCase();
    const acMatch = text.match(/ca\s*(\d+)/i);
    const baseAc = acMatch ? parseInt(acMatch[1], 10) : null;
    const isHeavy = text.includes('cota de malha') || text.includes('placas');
    const isMedium = text.includes('escama') || text.includes('gibão');
    return { baseAc, isHeavy, isMedium };
  };

  const recalcAc = () => {
    const dexMod = getModifier('dex');
    const equipped = getEquippedItems();
    const armor = equipped.find(i => i.type === 'Armadura');
    const shieldCount = equipped.filter(i => i.type === 'Escudo').length;
    let ac = 10 + dexMod;
    if (armor) {
      const info = _parseArmorInfo(armor);
      if (info.baseAc) {
        if (info.isHeavy) ac = info.baseAc;
        else if (info.isMedium) ac = info.baseAc + Math.min(dexMod, 2);
        else ac = info.baseAc + dexMod;
      }
    }
    if (shieldCount > 0) ac += 2;
    _state.combat.ac = ac;
    _state.combat.initiative = dexMod;
    _state.combat.passivePerception = 10 + getSkillMod('perception');
    save();
    return ac;
  };

  const recalcAttacks = () => {
    const prof = getProficiencyBonus();
    const strMod = getModifier('str');
    const dexMod = getModifier('dex');
    const weapons = getEquippedWeapons().slice(0, 3);
    const attacks = weapons.map(w => {
      const props = (w.wProps || '').toLowerCase();
      const finesse = props.includes('finesse') || props.includes('acuidade');
      const ranged = (w.wRange || '').toLowerCase().includes('longa');
      const atkMod = ranged ? dexMod : (finesse ? Math.max(strMod, dexMod) : strMod);
      const bonus = prof + atkMod;
      return {
        id: w.id,
        name: w.name,
        attackBonus: bonus,
        damage: `${w.wDice || '1d4'} ${w.wDmgType || ''}`.trim(),
        abilityMod: atkMod
      };
    });
    _state.progression.attacks = attacks;
    save();
    return attacks;
  };

  const resetShortRest = () => {
    const pool = _state.combat.hitDicePool || { total: 1, spent: 0, die: 8 };
    pool.spent = Math.max(0, pool.spent);
    _state.combat.hitDicePool = pool;
    save();
  };

  const resetLongRest = () => {
    _state.combat.hp.current = _state.combat.hp.max;
    _state.combat.hp.temp = 0;
    _state.combat.deathSaves = { successes: [false, false, false], failures: [false, false, false] };
    const pool = _state.combat.hitDicePool || { total: 1, spent: 0, die: 8 };
    pool.spent = Math.max(0, pool.spent - Math.floor(pool.spent / 2));
    _state.combat.hitDicePool = pool;
    Object.keys(_state.spells.slots || {}).forEach(level => {
      const slot = _state.spells.slots[level];
      _state.spells.slots[level] = { ...slot, used: 0 };
    });
    save();
  };

  // ── Persistence ──
  const save = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(_state));
    } catch (e) {
      console.warn('State save failed:', e);
    }
  };

  const load = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        _state = deepMerge(_defaults(), parsed);
        return true;
      }
    } catch (e) {
      console.warn('State load failed:', e);
    }
    return false;
  };

  const exportJSON = () => {
    const json = JSON.stringify(_state, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = `${_state.identity.name || 'personagem'}_sheet.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const importJSON = (jsonString) => {
    try {
      const parsed = JSON.parse(jsonString);
      _state = deepMerge(_defaults(), parsed);
      save();
      return true;
    } catch (e) {
      return false;
    }
  };

  const reset = () => {
    _state = _defaults();
    save();
  };

  const get = () => _state;

  const set = (path, value) => {
    setNestedValue(_state, path, value);
    save();
  };

  const patch = (partialState) => {
    _state = deepMerge(_state, partialState);
    save();
  };

  // ── Inventory CRUD (categorizado) ──────────────────────────────────────
  const CATEGORIES = ['Equipamentos','Armas','Poções','Acessórios','Utilizáveis'];
  const SLOTS_MAX  = 50;

  const _ensureCategories = () => {
    if (!_state.inventory || Array.isArray(_state.inventory)) {
      _state.inventory = { 'Equipamentos':[], 'Armas':[], 'Poções':[], 'Acessórios':[], 'Utilizáveis':[] };
    }
    CATEGORIES.forEach(c => { if (!_state.inventory[c]) _state.inventory[c] = []; });
  };

  const getItemsByCategory = (cat) => {
    _ensureCategories();
    return _state.inventory[cat] || [];
  };

  const addItem = (cat, item) => {
    _ensureCategories();
    if (!CATEGORIES.includes(cat)) return null;
    const list = _state.inventory[cat];
    if (list.length >= SLOTS_MAX) return null;
    const newItem = {
      id:       `item_${Date.now()}_${Math.random().toString(36).slice(2,7)}`,
      name:     item.name     || 'Item',
      type:     item.type     || 'Outros',
      qty:      parseInt(item.qty)    || 1,
      status:   item.status   || 'Normal',
      desc:     item.desc     || '',
      img:      item.img      || null,
      wDmgType: item.wDmgType || '',
      wDice:    item.wDice    || '',
      wRange:   item.wRange   || '',
      wAtk:     item.wAtk     || '',
      wProps:   item.wProps   || '',
      weight:   parseFloat(item.weight) || 0,
      equipped: !!item.equipped
    };
    list.push(newItem);
    _enforceEquipmentRules(newItem.id);
    recalcAc();
    recalcAttacks();
    save();
    return newItem;
  };

  const updateItem = (cat, id, updates, newCat) => {
    _ensureCategories();
    const list = _state.inventory[cat];
    const idx  = list.findIndex(i => i.id === id);
    if (idx === -1) return false;

    const merged = { ...list[idx], ...updates };
    merged.qty = parseInt(merged.qty) || 1;
    merged.weight = parseFloat(merged.weight) || 0;
    merged.equipped = !!merged.equipped;

    if (newCat && newCat !== cat && CATEGORIES.includes(newCat)) {
      if (_state.inventory[newCat].length >= SLOTS_MAX) return false;
      list.splice(idx, 1);
      _state.inventory[newCat].push(merged);
    } else {
      list[idx] = merged;
    }
    _enforceEquipmentRules(merged.id);
    recalcAc();
    recalcAttacks();
    save();
    return true;
  };

  const deleteItem = (cat, id) => {
    _ensureCategories();
    const list = _state.inventory[cat];
    const idx  = list.findIndex(i => i.id === id);
    if (idx === -1) return false;
    list.splice(idx, 1);
    recalcAc();
    recalcAttacks();
    save();
    return true;
  };

  const _enforceEquipmentRules = (changedItemId = null) => {
    _ensureCategories();
    const equips = _state.inventory['Equipamentos'] || [];
    const weapons = _state.inventory['Armas'] || [];
    const armors = equips.filter(i => i.equipped && i.type === 'Armadura');
    const shields = equips.filter(i => i.equipped && i.type === 'Escudo');
    const eqWeapons = weapons.filter(i => i.equipped);
    if (armors.length > 1) {
      armors.slice(1).forEach(i => { i.equipped = false; });
    }
    if (shields.length > 1) {
      shields.slice(1).forEach(i => { i.equipped = false; });
    }
    if (eqWeapons.length > 3) {
      eqWeapons.slice(3).forEach(i => { i.equipped = false; });
    }
    if (changedItemId) {
      const item = [...equips, ...weapons].find(i => i.id === changedItemId);
      if (item && item.equipped && item.status !== 'Equipado') item.status = 'Equipado';
      if (item && !item.equipped && item.status === 'Equipado') item.status = 'Normal';
    }
  };

  const toggleEquipItem = (cat, id) => {
    _ensureCategories();
    const list = _state.inventory[cat] || [];
    const item = list.find(i => i.id === id);
    if (!item) return { ok: false, reason: 'Item não encontrado.' };
    item.equipped = !item.equipped;
    _enforceEquipmentRules(id);
    recalcAc();
    recalcAttacks();
    save();
    return { ok: true, equipped: item.equipped };
  };

  const getTotalWeight = () => {
    _ensureCategories();
    return CATEGORIES.reduce((sum, cat) =>
      sum + _state.inventory[cat].reduce((s, item) =>
        s + ((parseFloat(item.weight) || 0) * (item.qty || 1)), 0), 0);
  };

  // ── Coins ───────────────────────────────────────────────────────────────
  const TO_PO = { pp: 10, po: 1, pe: 0.5, pa: 0.1, pc: 0.01 };

  const updateCoins = (key, delta) => {
    if (!_state.coins) _state.coins = { pp:0, po:0, pe:0, pa:0, pc:0 };
    _state.coins[key] = Math.max(0, (_state.coins[key] || 0) + delta);
    save();
    return _state.coins[key];
  };

  const setCoins = (key, value) => {
    if (!_state.coins) _state.coins = { pp:0, po:0, pe:0, pa:0, pc:0 };
    _state.coins[key] = Math.max(0, parseInt(value) || 0);
    save();
  };

  const getTotalPO = () => {
    const c = _state.coins || {};
    return Object.keys(TO_PO).reduce((s, k) => s + (c[k] || 0) * TO_PO[k], 0);
  };

  // ── Spells ──
  const prepareSpell = (spellId, maxPrepared = Infinity) => {
    if (_state.spells.prepared.length >= maxPrepared) return false;
    if (!_state.spells.prepared.includes(spellId)) {
      _state.spells.prepared.push(spellId);
      save();
      return true;
    }
    return false;
  };

  const unprepareSpell = (spellId) => {
    _state.spells.prepared = _state.spells.prepared.filter(id => id !== spellId);
    save();
  };

  const isSpellPrepared = (spellId) => _state.spells.prepared.includes(spellId);

  const setSpellSlots = (slotsByLevel = {}) => {
    _state.spells.slots = slotsByLevel;
    save();
  };

  const useSpellSlot = (level) => {
    const slot = _state.spells.slots?.[level];
    if (!slot) return false;
    if (slot.used >= slot.total) return false;
    slot.used += 1;
    save();
    return true;
  };

  const restoreSpellSlot = (level) => {
    const slot = _state.spells.slots?.[level];
    if (!slot) return false;
    slot.used = Math.max(0, slot.used - 1);
    save();
    return true;
  };

  return {
    get, set, patch, save, load, reset, exportJSON, importJSON,
    getTotalAttr, getModifier, getProficiencyBonus, getSkillMod, getSaveMod,
    addItem, updateItem, deleteItem, getTotalWeight,
    getItemsByCategory, CATEGORIES, SLOTS_MAX,
    updateCoins, setCoins, getTotalPO,
    prepareSpell, unprepareSpell, isSpellPrepared, setSpellSlots, useSpellSlot, restoreSpellSlot,
    getCarryCapacity, recalcAc, recalcAttacks, resetShortRest, resetLongRest, toggleEquipItem, getEquippedItems
  };
})();

// ── Utility: deepMerge ──────────────────────────────────────────────────────
function deepMerge(target, source) {
  const output = Object.assign({}, target);
  if (isObject(target) && isObject(source)) {
    Object.keys(source).forEach(key => {
      if (isObject(source[key])) {
        if (!(key in target)) Object.assign(output, { [key]: source[key] });
        else output[key] = deepMerge(target[key], source[key]);
      } else {
        Object.assign(output, { [key]: source[key] });
      }
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

// ── Router ──────────────────────────────────────────────────────────────────
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

// ── Toast ───────────────────────────────────────────────────────────────────
export const Toast = (() => {
  const show = (msg, duration = 3000) => {
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

// ── Data Loader ─────────────────────────────────────────────────────────────
export const DataLoader = (() => {
  const _cache = {};

  const load = async (path) => {
    if (_cache[path]) return _cache[path];
    try {
      const res = await fetch(path);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      _cache[path] = data;
      return data;
    } catch (e) {
      console.error(`DataLoader: failed to load ${path}`, e);
      return null;
    }
  };

  return { load };
})();

// ── Formatters ──────────────────────────────────────────────────────────────
export const fmt = {
  modifier: (n) => n >= 0 ? `+${n}` : `${n}`,
  signedNum: (n) => n >= 0 ? `+${n}` : `${n}`
};

// ── ThemeManager ─────────────────────────────────────────────────────────────
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
