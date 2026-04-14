/**
 * wizard.js — Character Creation Wizard (D&D 5e compliant)
 * Steps: 1-Raça → 2-Classe & Perícias → 3-Atributos → 4-Equipamento → 5-Detalhes
 */

import { CharacterState, DataLoader, Toast, fmt } from './app.js';

// ══════════════════════════════════════════════════════════════════════════════
// DATA TABLES
// ══════════════════════════════════════════════════════════════════════════════

const ATTR_LABELS = {
  str: { abbr: 'FOR', full: 'Força' },
  dex: { abbr: 'DES', full: 'Destreza' },
  con: { abbr: 'CON', full: 'Constituição' },
  int: { abbr: 'INT', full: 'Inteligência' },
  wis: { abbr: 'SAB', full: 'Sabedoria' },
  cha: { abbr: 'CAR', full: 'Carisma' }
};

// Standard Array values
const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8];

// Point Buy cost table (value → cost)
const PB_COST = { 8:0, 9:1, 10:2, 11:3, 12:4, 13:5, 14:7, 15:9 };
const PB_BUDGET = 27;
const PB_MIN = 8;
const PB_MAX = 15;

const CLASSES = [
  {
    id: 'barbarian', name: 'Bárbaro', icon: '⚔️', hitDie: 'd12', saves: ['str','con'],
    armorProf: 'Leve, Média, Escudos', weaponProf: 'Simples, Marciais',
    skillCount: 2,
    skillPool: ['animal-handling','athletics','intimidation','nature','perception','survival'],
    startingGold: { dice: 2, sides: 4, mult: 10 },
    equipment: {
      optionA: {
        label: 'Machado de Grande + 2 Machadinhas',
        items: [
          { name:'Machado de Grande', cat:'Armas', type:'Machado', qty:1, status:'Normal', desc:'2d6 cortante, Pesada, Duas mãos', wDmgType:'Cortante', wDice:'2d6', wRange:'Corpo a corpo', wAtk:'', wProps:'Pesada, Duas Mãos' },
          { name:'Machadinha', cat:'Armas', type:'Machado', qty:2, status:'Normal', desc:'1d6 cortante, Leve, Arremesso', wDmgType:'Cortante', wDice:'1d6', wRange:'Ambos', wAtk:'', wProps:'Leve, Arremesso' },
          { name:'Pacote de Explorador', cat:'Equipamentos', type:'Outros', qty:1, status:'Normal', desc:'Mochila, saco de dormir, kit de refeição, materiais de acampamento.' }
        ],
        armorAC: null
      },
      optionB: {
        label: '2 Machadinhas + 4 Azagaias',
        items: [
          { name:'Machadinha', cat:'Armas', type:'Machado', qty:2, status:'Normal', desc:'1d6 cortante, Leve, Arremesso', wDmgType:'Cortante', wDice:'1d6', wRange:'Ambos', wAtk:'', wProps:'Leve, Arremesso' },
          { name:'Azagaia', cat:'Armas', type:'Lança', qty:4, status:'Normal', desc:'1d6 perfurante, Arremesso', wDmgType:'Perfurante', wDice:'1d6', wRange:'Ambos', wAtk:'', wProps:'Arremesso' }
        ],
        armorAC: null
      }
    }
  },
  {
    id: 'bard', name: 'Bardo', icon: '🎶', hitDie: 'd8', saves: ['dex','cha'],
    armorProf: 'Leve', weaponProf: 'Simples, Espada de Mão, Espada Longa, Rapieira',
    skillCount: 3, skillPool: 'any',
    startingGold: { dice: 5, sides: 4, mult: 10 },
    equipment: {
      optionA: {
        label: 'Rapieira + Diplomata',
        items: [
          { name:'Rapieira', cat:'Armas', type:'Espada', qty:1, status:'Normal', desc:'1d8 perfurante, Finesse', wDmgType:'Perfurante', wDice:'1d8', wRange:'Corpo a corpo', wAtk:'', wProps:'Finesse' },
          { name:'Armadura de Couro', cat:'Equipamentos', type:'Armadura', qty:1, status:'Equipado', desc:'CA 11 + mod DES' },
          { name:'Pacote do Diplomata', cat:'Equipamentos', type:'Outros', qty:1, status:'Normal', desc:'Baú, estojo de documentos, garrafa de tinta, pena, perfume.' }
        ],
        armorAC: 11
      },
      optionB: {
        label: 'Espada Longa + Artista',
        items: [
          { name:'Espada Longa', cat:'Armas', type:'Espada', qty:1, status:'Normal', desc:'1d8/1d10 cortante, Versátil', wDmgType:'Cortante', wDice:'1d8', wRange:'Corpo a corpo', wAtk:'', wProps:'Versátil (1d10)' },
          { name:'Armadura de Couro', cat:'Equipamentos', type:'Armadura', qty:1, status:'Equipado', desc:'CA 11 + mod DES' },
          { name:'Pacote de Artista', cat:'Equipamentos', type:'Outros', qty:1, status:'Normal', desc:'Mochila, kit de fantasia, roupas, vela.' }
        ],
        armorAC: 11
      }
    }
  },
  {
    id: 'cleric', name: 'Clérigo', icon: '✝️', hitDie: 'd8', saves: ['wis','cha'],
    armorProf: 'Leve, Média, Escudos', weaponProf: 'Simples',
    skillCount: 2, skillPool: ['history','insight','medicine','persuasion','religion'],
    startingGold: { dice: 5, sides: 4, mult: 10 },
    equipment: {
      optionA: {
        label: 'Maça + Escama + Escudo',
        items: [
          { name:'Maça', cat:'Armas', type:'Maça', qty:1, status:'Normal', desc:'1d6 contundente', wDmgType:'Contundente', wDice:'1d6', wRange:'Corpo a corpo', wAtk:'', wProps:'' },
          { name:'Armadura de Escama', cat:'Equipamentos', type:'Armadura', qty:1, status:'Equipado', desc:'CA 14 + mod DES (máx 2)' },
          { name:'Escudo', cat:'Equipamentos', type:'Escudo', qty:1, status:'Equipado', desc:'+2 CA' },
          { name:'Símbolo Sagrado', cat:'Acessórios', type:'Amuleto', qty:1, status:'Equipado', desc:'Foco de conjuração sagrado.' },
          { name:'Pacote do Padre', cat:'Equipamentos', type:'Outros', qty:1, status:'Normal', desc:'Mochila, cobertor, vela ×10, caixa de madeira, símbolo sagrado.' }
        ],
        armorAC: 16
      },
      optionB: {
        label: 'Maça + Couro + Besta Leve',
        items: [
          { name:'Maça', cat:'Armas', type:'Maça', qty:1, status:'Normal', desc:'1d6 contundente', wDmgType:'Contundente', wDice:'1d6', wRange:'Corpo a corpo', wAtk:'', wProps:'' },
          { name:'Armadura de Couro', cat:'Equipamentos', type:'Armadura', qty:1, status:'Equipado', desc:'CA 11 + mod DES' },
          { name:'Besta Leve', cat:'Armas', type:'Arco', qty:1, status:'Normal', desc:'1d8 perfurante, Munição, Recarga', wDmgType:'Perfurante', wDice:'1d8', wRange:'Longa distância', wAtk:'', wProps:'Munição, Recarga' },
          { name:'Virotes de Besta (20)', cat:'Utilizáveis', type:'Outros', qty:20, status:'Normal', desc:'' },
          { name:'Símbolo Sagrado', cat:'Acessórios', type:'Amuleto', qty:1, status:'Equipado', desc:'Foco de conjuração sagrado.' }
        ],
        armorAC: 11
      }
    }
  },
  {
    id: 'druid', name: 'Druida', icon: '🌿', hitDie: 'd8', saves: ['int','wis'],
    armorProf: 'Leve, Média, Escudos (não metálicos)', weaponProf: 'Clava, Adaga, Dardo, Azagaia, Maça, Bastão, Cimitarra, Foice, Funda, Lança',
    skillCount: 2, skillPool: ['arcana','animal-handling','insight','medicine','nature','perception','religion','survival'],
    startingGold: { dice: 2, sides: 4, mult: 10 },
    equipment: {
      optionA: {
        label: 'Escudo de Madeira + Cimitarra',
        items: [
          { name:'Escudo de Madeira', cat:'Equipamentos', type:'Escudo', qty:1, status:'Equipado', desc:'+2 CA' },
          { name:'Cimitarra', cat:'Armas', type:'Espada', qty:1, status:'Normal', desc:'1d6 cortante, Finesse, Leve', wDmgType:'Cortante', wDice:'1d6', wRange:'Corpo a corpo', wAtk:'', wProps:'Finesse, Leve' },
          { name:'Armadura de Couro', cat:'Equipamentos', type:'Armadura', qty:1, status:'Equipado', desc:'CA 11 + mod DES' },
          { name:'Foco Druídico', cat:'Acessórios', type:'Outros', qty:1, status:'Equipado', desc:'Bastão de madeira rúnica.' },
          { name:'Pacote de Explorador', cat:'Equipamentos', type:'Outros', qty:1, status:'Normal', desc:'Mochila, kit de acampamento.' }
        ],
        armorAC: 13
      },
      optionB: {
        label: 'Maça + Couro',
        items: [
          { name:'Maça', cat:'Armas', type:'Maça', qty:1, status:'Normal', desc:'1d6 contundente', wDmgType:'Contundente', wDice:'1d6', wRange:'Corpo a corpo', wAtk:'', wProps:'' },
          { name:'Armadura de Couro', cat:'Equipamentos', type:'Armadura', qty:1, status:'Equipado', desc:'CA 11 + mod DES' },
          { name:'Foco Druídico', cat:'Acessórios', type:'Outros', qty:1, status:'Equipado', desc:'Bastão de madeira rúnica.' }
        ],
        armorAC: 11
      }
    }
  },
  {
    id: 'fighter', name: 'Guerreiro', icon: '🛡️', hitDie: 'd10', saves: ['str','con'],
    armorProf: 'Todas + Escudos', weaponProf: 'Simples, Marciais',
    skillCount: 2, skillPool: ['acrobatics','animal-handling','athletics','history','insight','intimidation','perception','survival'],
    startingGold: { dice: 5, sides: 4, mult: 10 },
    equipment: {
      optionA: {
        label: 'Cota de Malha + Escudo + Espada Curta',
        items: [
          { name:'Cota de Malha', cat:'Equipamentos', type:'Armadura', qty:1, status:'Equipado', desc:'CA 16; Desvantagem em Furtividade' },
          { name:'Escudo', cat:'Equipamentos', type:'Escudo', qty:1, status:'Equipado', desc:'+2 CA' },
          { name:'Espada Curta', cat:'Armas', type:'Espada', qty:1, status:'Normal', desc:'1d6 perfurante, Finesse, Leve', wDmgType:'Perfurante', wDice:'1d6', wRange:'Corpo a corpo', wAtk:'', wProps:'Finesse, Leve' },
          { name:'Besta Leve', cat:'Armas', type:'Arco', qty:1, status:'Normal', desc:'1d8 perfurante, Munição, Recarga', wDmgType:'Perfurante', wDice:'1d8', wRange:'Longa distância', wAtk:'', wProps:'Munição, Recarga' },
          { name:'Virotes de Besta (20)', cat:'Utilizáveis', type:'Outros', qty:20, status:'Normal', desc:'' },
          { name:'Pacote do Aventureiro', cat:'Equipamentos', type:'Outros', qty:1, status:'Normal', desc:'Mochila, saco de dormir, kit de refeição.' }
        ],
        armorAC: 18
      },
      optionB: {
        label: 'Couro + Arco Longo + 2 Machados de Mão',
        items: [
          { name:'Armadura de Couro', cat:'Equipamentos', type:'Armadura', qty:1, status:'Equipado', desc:'CA 11 + mod DES' },
          { name:'Arco Longo', cat:'Armas', type:'Arco', qty:1, status:'Normal', desc:'1d8 perfurante, Munição, Duas mãos', wDmgType:'Perfurante', wDice:'1d8', wRange:'Longa distância', wAtk:'', wProps:'Munição, Duas Mãos' },
          { name:'Flecha (20)', cat:'Utilizáveis', type:'Outros', qty:20, status:'Normal', desc:'' },
          { name:'Machado de Mão', cat:'Armas', type:'Machado', qty:2, status:'Normal', desc:'1d6 cortante, Leve, Arremesso', wDmgType:'Cortante', wDice:'1d6', wRange:'Ambos', wAtk:'', wProps:'Leve, Arremesso' },
          { name:'Pacote do Aventureiro', cat:'Equipamentos', type:'Outros', qty:1, status:'Normal', desc:'' }
        ],
        armorAC: 11
      }
    }
  },
  {
    id: 'monk', name: 'Monge', icon: '👊', hitDie: 'd8', saves: ['str','dex'],
    armorProf: 'Nenhuma', weaponProf: 'Simples, Espada Curta',
    skillCount: 2, skillPool: ['acrobatics','athletics','history','insight','religion','stealth'],
    startingGold: { dice: 5, sides: 4, mult: 1 },
    equipment: {
      optionA: {
        label: 'Espada Curta + Pacote de Explorador',
        items: [
          { name:'Espada Curta', cat:'Armas', type:'Espada', qty:1, status:'Normal', desc:'1d6 perfurante, Finesse, Leve', wDmgType:'Perfurante', wDice:'1d6', wRange:'Corpo a corpo', wAtk:'', wProps:'Finesse, Leve' },
          { name:'Pacote de Explorador', cat:'Equipamentos', type:'Outros', qty:1, status:'Normal', desc:'' },
          { name:'Dardo', cat:'Armas', type:'Adaga', qty:10, status:'Normal', desc:'1d4 perfurante, Arremesso, Leve', wDmgType:'Perfurante', wDice:'1d4', wRange:'Ambos', wAtk:'', wProps:'Arremesso, Leve' }
        ],
        armorAC: null
      },
      optionB: {
        label: 'Qualquer Arma Simples + Pacote do Aventureiro',
        items: [
          { name:'Clava', cat:'Armas', type:'Maça', qty:1, status:'Normal', desc:'1d4 contundente, Leve', wDmgType:'Contundente', wDice:'1d4', wRange:'Corpo a corpo', wAtk:'', wProps:'Leve' },
          { name:'Pacote do Aventureiro', cat:'Equipamentos', type:'Outros', qty:1, status:'Normal', desc:'' },
          { name:'Dardo', cat:'Armas', type:'Adaga', qty:10, status:'Normal', desc:'1d4 perfurante, Arremesso, Leve', wDmgType:'Perfurante', wDice:'1d4', wRange:'Ambos', wAtk:'', wProps:'Arremesso, Leve' }
        ],
        armorAC: null
      }
    }
  },
  {
    id: 'paladin', name: 'Paladino', icon: '⚜️', hitDie: 'd10', saves: ['wis','cha'],
    armorProf: 'Todas + Escudos', weaponProf: 'Simples, Marciais',
    skillCount: 2, skillPool: ['athletics','insight','intimidation','medicine','persuasion','religion'],
    startingGold: { dice: 5, sides: 4, mult: 10 },
    equipment: {
      optionA: {
        label: 'Cota de Malha + Escudo + Espada Longa',
        items: [
          { name:'Cota de Malha', cat:'Equipamentos', type:'Armadura', qty:1, status:'Equipado', desc:'CA 16; Desvantagem em Furtividade' },
          { name:'Escudo', cat:'Equipamentos', type:'Escudo', qty:1, status:'Equipado', desc:'+2 CA' },
          { name:'Espada Longa', cat:'Armas', type:'Espada', qty:1, status:'Normal', desc:'1d8 cortante, Versátil (1d10)', wDmgType:'Cortante', wDice:'1d8', wRange:'Corpo a corpo', wAtk:'', wProps:'Versátil (1d10)' },
          { name:'Azagaia', cat:'Armas', type:'Lança', qty:5, status:'Normal', desc:'1d6 perfurante, Arremesso', wDmgType:'Perfurante', wDice:'1d6', wRange:'Ambos', wAtk:'', wProps:'Arremesso' },
          { name:'Símbolo Sagrado', cat:'Acessórios', type:'Amuleto', qty:1, status:'Equipado', desc:'Foco de conjuração sagrado.' },
          { name:'Pacote do Padre', cat:'Equipamentos', type:'Outros', qty:1, status:'Normal', desc:'' }
        ],
        armorAC: 18
      },
      optionB: {
        label: 'Cota de Malha + 2 Machadinhas',
        items: [
          { name:'Cota de Malha', cat:'Equipamentos', type:'Armadura', qty:1, status:'Equipado', desc:'CA 16; Desvantagem em Furtividade' },
          { name:'Machadinha', cat:'Armas', type:'Machado', qty:2, status:'Normal', desc:'1d6 cortante, Leve, Arremesso', wDmgType:'Cortante', wDice:'1d6', wRange:'Ambos', wAtk:'', wProps:'Leve, Arremesso' },
          { name:'Símbolo Sagrado', cat:'Acessórios', type:'Amuleto', qty:1, status:'Equipado', desc:'Foco de conjuração sagrado.' },
          { name:'Pacote do Aventureiro', cat:'Equipamentos', type:'Outros', qty:1, status:'Normal', desc:'' }
        ],
        armorAC: 16
      }
    }
  },
  {
    id: 'ranger', name: 'Patrulheiro', icon: '🏹', hitDie: 'd10', saves: ['str','dex'],
    armorProf: 'Leve, Média, Escudos', weaponProf: 'Simples, Marciais',
    skillCount: 3, skillPool: ['animal-handling','athletics','insight','investigation','nature','perception','stealth','survival'],
    startingGold: { dice: 5, sides: 4, mult: 10 },
    equipment: {
      optionA: {
        label: 'Escama + 2 Espadas Curtas',
        items: [
          { name:'Armadura de Escama', cat:'Equipamentos', type:'Armadura', qty:1, status:'Equipado', desc:'CA 14 + mod DES (máx 2)' },
          { name:'Espada Curta', cat:'Armas', type:'Espada', qty:2, status:'Normal', desc:'1d6 perfurante, Finesse, Leve', wDmgType:'Perfurante', wDice:'1d6', wRange:'Corpo a corpo', wAtk:'', wProps:'Finesse, Leve' },
          { name:'Pacote de Explorador', cat:'Equipamentos', type:'Outros', qty:1, status:'Normal', desc:'' }
        ],
        armorAC: 14
      },
      optionB: {
        label: 'Couro + 2 Machadinhas + Arco Longo',
        items: [
          { name:'Armadura de Couro', cat:'Equipamentos', type:'Armadura', qty:1, status:'Equipado', desc:'CA 11 + mod DES' },
          { name:'Machadinha', cat:'Armas', type:'Machado', qty:2, status:'Normal', desc:'1d6 cortante, Leve, Arremesso', wDmgType:'Cortante', wDice:'1d6', wRange:'Ambos', wAtk:'', wProps:'Leve, Arremesso' },
          { name:'Arco Longo', cat:'Armas', type:'Arco', qty:1, status:'Normal', desc:'1d8 perfurante, Munição, Duas mãos', wDmgType:'Perfurante', wDice:'1d8', wRange:'Longa distância', wAtk:'', wProps:'Munição, Duas Mãos' },
          { name:'Flecha (20)', cat:'Utilizáveis', type:'Outros', qty:20, status:'Normal', desc:'' }
        ],
        armorAC: 11
      }
    }
  },
  {
    id: 'rogue', name: 'Ladino', icon: '🗡️', hitDie: 'd8', saves: ['dex','int'],
    armorProf: 'Leve', weaponProf: 'Simples, Besta de Mão, Espada Longa, Rapieira, Espada Curta',
    skillCount: 4, skillPool: ['acrobatics','athletics','deception','insight','intimidation','investigation','perception','performance','persuasion','sleight-of-hand','stealth'],
    startingGold: { dice: 4, sides: 4, mult: 10 },
    equipment: {
      optionA: {
        label: 'Rapieira + Besta de Mão + Couro',
        items: [
          { name:'Rapieira', cat:'Armas', type:'Espada', qty:1, status:'Normal', desc:'1d8 perfurante, Finesse', wDmgType:'Perfurante', wDice:'1d8', wRange:'Corpo a corpo', wAtk:'', wProps:'Finesse' },
          { name:'Besta de Mão', cat:'Armas', type:'Arco', qty:1, status:'Normal', desc:'1d6 perfurante, Munição, Leve, Recarga', wDmgType:'Perfurante', wDice:'1d6', wRange:'Longa distância', wAtk:'', wProps:'Munição, Leve, Recarga' },
          { name:'Virotes de Besta (20)', cat:'Utilizáveis', type:'Outros', qty:20, status:'Normal', desc:'' },
          { name:'Armadura de Couro', cat:'Equipamentos', type:'Armadura', qty:1, status:'Equipado', desc:'CA 11 + mod DES' },
          { name:'Ferramentas de Ladrão', cat:'Utilizáveis', type:'Ferramenta', qty:1, status:'Normal', desc:'' },
          { name:'Pacote do Aventureiro', cat:'Equipamentos', type:'Outros', qty:1, status:'Normal', desc:'' }
        ],
        armorAC: 11
      },
      optionB: {
        label: '2 Adagas + Couro',
        items: [
          { name:'Adaga', cat:'Armas', type:'Adaga', qty:2, status:'Normal', desc:'1d4 perfurante, Finesse, Leve, Arremesso', wDmgType:'Perfurante', wDice:'1d4', wRange:'Ambos', wAtk:'', wProps:'Finesse, Leve, Arremesso' },
          { name:'Armadura de Couro', cat:'Equipamentos', type:'Armadura', qty:1, status:'Equipado', desc:'CA 11 + mod DES' },
          { name:'Ferramentas de Ladrão', cat:'Utilizáveis', type:'Ferramenta', qty:1, status:'Normal', desc:'' },
          { name:'Pacote do Aventureiro', cat:'Equipamentos', type:'Outros', qty:1, status:'Normal', desc:'' }
        ],
        armorAC: 11
      }
    }
  },
  {
    id: 'sorcerer', name: 'Feiticeiro', icon: '✨', hitDie: 'd6', saves: ['con','cha'],
    armorProf: 'Nenhuma', weaponProf: 'Adaga, Dardo, Funda, Bastão, Besta Leve',
    skillCount: 2, skillPool: ['arcana','deception','insight','intimidation','persuasion','religion'],
    startingGold: { dice: 3, sides: 4, mult: 10 },
    equipment: {
      optionA: {
        label: 'Besta Leve + Foco Arcano',
        items: [
          { name:'Besta Leve', cat:'Armas', type:'Arco', qty:1, status:'Normal', desc:'1d8 perfurante, Munição, Recarga', wDmgType:'Perfurante', wDice:'1d8', wRange:'Longa distância', wAtk:'', wProps:'Munição, Recarga' },
          { name:'Virotes de Besta (20)', cat:'Utilizáveis', type:'Outros', qty:20, status:'Normal', desc:'' },
          { name:'Foco Arcano', cat:'Acessórios', type:'Amuleto', qty:1, status:'Equipado', desc:'Cristal, varinha ou orbe focalizador.' },
          { name:'Pacote do Aventureiro', cat:'Equipamentos', type:'Outros', qty:1, status:'Normal', desc:'' }
        ],
        armorAC: null
      },
      optionB: {
        label: '2 Adagas + Foco Arcano',
        items: [
          { name:'Adaga', cat:'Armas', type:'Adaga', qty:2, status:'Normal', desc:'1d4 perfurante, Finesse, Leve, Arremesso', wDmgType:'Perfurante', wDice:'1d4', wRange:'Ambos', wAtk:'', wProps:'Finesse, Leve, Arremesso' },
          { name:'Foco Arcano', cat:'Acessórios', type:'Amuleto', qty:1, status:'Equipado', desc:'Cristal, varinha ou orbe focalizador.' },
          { name:'Pacote do Aventureiro', cat:'Equipamentos', type:'Outros', qty:1, status:'Normal', desc:'' }
        ],
        armorAC: null
      }
    }
  },
  {
    id: 'warlock', name: 'Bruxo', icon: '🌑', hitDie: 'd8', saves: ['wis','cha'],
    armorProf: 'Leve', weaponProf: 'Simples',
    skillCount: 2, skillPool: ['arcana','deception','history','intimidation','investigation','nature','religion'],
    startingGold: { dice: 4, sides: 4, mult: 10 },
    equipment: {
      optionA: {
        label: 'Besta Leve + Foco Arcano + Couro',
        items: [
          { name:'Besta Leve', cat:'Armas', type:'Arco', qty:1, status:'Normal', desc:'1d8 perfurante, Munição, Recarga', wDmgType:'Perfurante', wDice:'1d8', wRange:'Longa distância', wAtk:'', wProps:'Munição, Recarga' },
          { name:'Virotes de Besta (20)', cat:'Utilizáveis', type:'Outros', qty:20, status:'Normal', desc:'' },
          { name:'Foco Arcano', cat:'Acessórios', type:'Amuleto', qty:1, status:'Equipado', desc:'Cristal, varinha ou orbe focalizador.' },
          { name:'Armadura de Couro', cat:'Equipamentos', type:'Armadura', qty:1, status:'Equipado', desc:'CA 11 + mod DES' },
          { name:'Pacote do Aventureiro', cat:'Equipamentos', type:'Outros', qty:1, status:'Normal', desc:'' }
        ],
        armorAC: 11
      },
      optionB: {
        label: '2 Adagas + Foco + Couro',
        items: [
          { name:'Adaga', cat:'Armas', type:'Adaga', qty:2, status:'Normal', desc:'1d4 perfurante, Finesse, Leve, Arremesso', wDmgType:'Perfurante', wDice:'1d4', wRange:'Ambos', wAtk:'', wProps:'Finesse, Leve, Arremesso' },
          { name:'Foco Arcano', cat:'Acessórios', type:'Amuleto', qty:1, status:'Equipado', desc:'Cristal, varinha ou orbe focalizador.' },
          { name:'Armadura de Couro', cat:'Equipamentos', type:'Armadura', qty:1, status:'Equipado', desc:'CA 11 + mod DES' },
          { name:'Pacote do Aventureiro', cat:'Equipamentos', type:'Outros', qty:1, status:'Normal', desc:'' }
        ],
        armorAC: 11
      }
    }
  },
  {
    id: 'wizard', name: 'Mago', icon: '🔮', hitDie: 'd6', saves: ['int','wis'],
    armorProf: 'Nenhuma', weaponProf: 'Adaga, Dardo, Funda, Bastão, Besta Leve',
    skillCount: 2, skillPool: ['arcana','history','insight','investigation','medicine','religion'],
    startingGold: { dice: 4, sides: 4, mult: 10 },
    equipment: {
      optionA: {
        label: 'Bastão + Grimório',
        items: [
          { name:'Bastão', cat:'Armas', type:'Maça', qty:1, status:'Normal', desc:'1d6 contundente, Versátil (1d8), Duas mãos', wDmgType:'Contundente', wDice:'1d6', wRange:'Corpo a corpo', wAtk:'', wProps:'Versátil (1d8)' },
          { name:'Grimório', cat:'Utilizáveis', type:'Pergaminho', qty:1, status:'Normal', desc:'Contém 6 truques e 2 magias de 1º nível.' },
          { name:'Bolsa de Componentes', cat:'Utilizáveis', type:'Outros', qty:1, status:'Normal', desc:'' },
          { name:'Pacote do Acadêmico', cat:'Equipamentos', type:'Outros', qty:1, status:'Normal', desc:'Mochila, livro, tinta, pena, velas, kit de refeição.' }
        ],
        armorAC: null
      },
      optionB: {
        label: 'Adaga + Foco Arcano + Grimório',
        items: [
          { name:'Adaga', cat:'Armas', type:'Adaga', qty:1, status:'Normal', desc:'1d4 perfurante, Finesse, Leve, Arremesso', wDmgType:'Perfurante', wDice:'1d4', wRange:'Ambos', wAtk:'', wProps:'Finesse, Leve, Arremesso' },
          { name:'Foco Arcano', cat:'Acessórios', type:'Amuleto', qty:1, status:'Equipado', desc:'Cristal, varinha ou orbe focalizador.' },
          { name:'Grimório', cat:'Utilizáveis', type:'Pergaminho', qty:1, status:'Normal', desc:'Contém 6 truques e 2 magias de 1º nível.' },
          { name:'Pacote do Acadêmico', cat:'Equipamentos', type:'Outros', qty:1, status:'Normal', desc:'' }
        ],
        armorAC: null
      }
    }
  }
];

// All skill IDs for "any" pool classes
const ALL_SKILLS = [
  'acrobatics','animal-handling','arcana','athletics','deception',
  'history','insight','intimidation','investigation','medicine',
  'nature','perception','performance','persuasion','religion',
  'sleight-of-hand','stealth','survival'
];

const SKILL_LABELS = {
  'acrobatics':'Acrobacia','animal-handling':'Lidar c/ Animais','arcana':'Arcanismo',
  'athletics':'Atletismo','deception':'Enganação','history':'História',
  'insight':'Intuição','intimidation':'Intimidação','investigation':'Investigação',
  'medicine':'Medicina','nature':'Natureza','perception':'Percepção',
  'performance':'Atuação','persuasion':'Persuasão','religion':'Religião',
  'sleight-of-hand':'Prestidigitação','stealth':'Furtividade','survival':'Sobrevivência'
};

const BACKGROUNDS = [
  {
    id: 'acolyte', name: 'Acólito', icon: '✝️',
    description: 'Você passou sua vida no serviço de um templo.',
    skills: ['insight','religion'],
    skillLabels: 'Intuição, Religião',
    feature: 'Abrigo dos Devotos'
  },
  {
    id: 'criminal', name: 'Criminoso', icon: '🗡️',
    description: 'Você tem experiência com o submundo criminoso.',
    skills: ['deception','stealth'],
    skillLabels: 'Enganação, Furtividade',
    feature: 'Contato Criminal'
  },
  {
    id: 'folk-hero', name: 'Herói do Povo', icon: '🌾',
    description: 'Você é um campeão das pessoas comuns.',
    skills: ['animal-handling','survival'],
    skillLabels: 'Lidar c/ Animais, Sobrevivência',
    feature: 'Hospitalidade Rústica'
  },
  {
    id: 'noble', name: 'Nobre', icon: '👑',
    description: 'Você nasceu em privilégio e autoridade.',
    skills: ['history','persuasion'],
    skillLabels: 'História, Persuasão',
    feature: 'Posição de Privilégio'
  },
  {
    id: 'sage', name: 'Sábio', icon: '📚',
    description: 'Você passou anos estudando os segredos do mundo.',
    skills: ['arcana','history'],
    skillLabels: 'Arcanismo, História',
    feature: 'Pesquisador'
  },
  {
    id: 'soldier', name: 'Soldado', icon: '⚔️',
    description: 'Você treinou e lutou em guerras.',
    skills: ['athletics','intimidation'],
    skillLabels: 'Atletismo, Intimidação',
    feature: 'Hierarquia Militar'
  },
  {
    id: 'outlander', name: 'Forasteiro', icon: '🏔️',
    description: 'Você cresceu nas partes selvagens do mundo.',
    skills: ['athletics','survival'],
    skillLabels: 'Atletismo, Sobrevivência',
    feature: 'Viajante'
  },
  {
    id: 'entertainer', name: 'Artista', icon: '🎭',
    description: 'Você prospera diante de uma audiência.',
    skills: ['acrobatics','performance'],
    skillLabels: 'Acrobacia, Atuação',
    feature: 'Por Amor ao Artista'
  }
];

const TOTAL_STEPS = 5;

// ══════════════════════════════════════════════════════════════════════════════
// WIZARD MODULE
// ══════════════════════════════════════════════════════════════════════════════

export const Wizard = (() => {
  let _races     = [];
  let _container = null;
  let _step      = 1;

  // Draft state — committed to CharacterState only in _finalize()
  let _draft = _emptyDraft();

  function _emptyDraft() {
    return {
      raceId:   null, race:   null,
      subraceId:null, subrace:null,
      choosableBonuses: [],
      classId:  null, classObj: null,
      selectedSkills:  [],   // class skill picks
      bgId:     null, bgObj: null,
      attrMode: 'standard',  // 'standard' | 'pointbuy'
      saAssigned: {},        // standard array: attrKey → value
      attributes: { str:{base:8},dex:{base:8},con:{base:8},int:{base:8},wis:{base:8},cha:{base:8} },
      equipChoice: 'A',      // 'A' | 'B' | 'gold'
      details: { name:'', level:1, alignment:'', playerName:'' }
    };
  }

  // ── Public ──────────────────────────────────────────────────────────────
  const init = async (containerEl) => {
    _container = containerEl;
    _races = await DataLoader.load('./data/races.json') || [];
    _step  = 1;
    _draft = _emptyDraft();
    _render();
  };

  // ── Shell ───────────────────────────────────────────────────────────────
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
            ${_step===TOTAL_STEPS ? 'Criar Personagem ✦' : 'Avançar →'}
          </button>
        </div>
      </div>`;
    document.getElementById('wiz-back')?.addEventListener('click', _prevStep);
    document.getElementById('wiz-next')?.addEventListener('click', _nextStep);
    _attachStepListeners();
  };

  const _renderStepBar = () => {
    const labels = ['Raça','Classe','Atributos','Equipamento','Detalhes'];
    let html = '<div class="wizard-step-bar">';
    labels.forEach((lbl, i) => {
      const n = i + 1;
      let cls = 'step-dot';
      if (n < _step) cls += ' done';
      else if (n === _step) cls += ' active';
      html += `<div class="${cls}" title="${lbl}">${n < _step ? '✓' : n}</div>`;
      if (i < labels.length - 1)
        html += `<div class="step-line ${n < _step ? 'done' : ''}"></div>`;
    });
    return html + '</div>';
  };

  const _renderStep = () => {
    switch (_step) {
      case 1: return _renderRaceStep();
      case 2: return _renderClassStep();
      case 3: return _renderAttrStep();
      case 4: return _renderEquipStep();
      case 5: return _renderDetailsStep();
      default: return '';
    }
  };

  // ══════════════════════════════════════════════════════════════════════════
  // STEP 1 — RACE + SUBRACE
  // ══════════════════════════════════════════════════════════════════════════
  const _renderRaceStep = () => {
    const grid = _races.map(race => {
      const sel = _draft.raceId === race.id ? 'selected' : '';
      const bonusText = _raceBonusSummary(race);
      const hasSub = race.subraces?.length ? `<div style="font-size:0.7rem;color:var(--arcane-bright);margin-top:2px">Sub-raças disponíveis</div>` : '';
      return `
        <div class="race-card ${sel}" data-race-id="${race.id}">
          <div class="race-name">${race.name}</div>
          <div class="race-bonus">${bonusText}</div>
          ${hasSub}
        </div>`;
    }).join('');

    const subraceHtml = _draft.race?.subraces ? _renderSubraceSection() : '';
    const choosableHtml = _draft.race?.choosableBonus && !_draft.race?.subraces ? _renderChoosableBonus() : '';

    return `
      <div class="wizard-step active">
        <div class="wizard-step-title">Etapa 1 de ${TOTAL_STEPS}</div>
        <h2>Escolha sua Raça</h2>
        <p class="text-muted mb-2" style="font-size:0.9rem">A raça e sub-raça definem os bônus raciais nos atributos.</p>
        <div class="race-grid">${grid}</div>
        <div id="subrace-container">${subraceHtml}</div>
        <div id="choosable-bonus-container">${choosableHtml}</div>
      </div>`;
  };

  const _renderSubraceSection = () => {
    if (!_draft.race?.subraces?.length) return '';
    const cards = _draft.race.subraces.map(sr => {
      const sel = _draft.subraceId === sr.id ? 'selected' : '';
      const bonusTxt = Object.entries(sr.abilityBonuses || {})
        .map(([k,v]) => `${ATTR_LABELS[k]?.abbr||k} +${v}`).join(', ');
      return `
        <div class="race-card ${sel}" data-subrace-id="${sr.id}" style="background:var(--bg-card-hover)">
          <div class="race-name">${sr.name}</div>
          <div class="race-bonus">${bonusTxt || '—'}</div>
          <div style="font-size:0.75rem;color:var(--text-muted);margin-top:3px">${sr.description}</div>
        </div>`;
    }).join('');
    return `
      <div class="choosable-bonus-section mt-2" style="border-color:var(--arcane-bright)">
        <p style="color:var(--arcane-bright)">Escolha uma sub-raça:</p>
        <div class="race-grid">${cards}</div>
      </div>`;
  };

  const _raceBonusSummary = (race) => {
    const parts = [];
    Object.entries(race.abilityBonuses || {}).forEach(([k,v]) => parts.push(`${ATTR_LABELS[k]?.abbr||k} +${v}`));
    if (race.choosableBonus) parts.push(`+${race.choosableBonus.amount} (×${race.choosableBonus.count} à escolha)`);
    if (race.subraces?.length) parts.push('+ sub-raça');
    return parts.join(', ') || '—';
  };

  const _renderChoosableBonus = () => {
    const cb = _draft.race?.choosableBonus;
    if (!cb) return '';
    const eligible = Object.keys(ATTR_LABELS).filter(k => !cb.exclude?.includes(k));
    const checkboxes = eligible.map(k => {
      const checked = _draft.choosableBonuses.includes(k);
      return `
        <label class="choosable-check-label ${checked?'selected':''}">
          <input type="checkbox" data-choosable="${k}" ${checked?'checked':''}>
          ${ATTR_LABELS[k].abbr} (+${cb.amount})
        </label>`;
    }).join('');
    return `
      <div class="choosable-bonus-section mt-2">
        <p>${cb.description} (${_draft.choosableBonuses.length}/${cb.count} selecionados)</p>
        <div class="choosable-checkboxes">${checkboxes}</div>
      </div>`;
  };

  // ══════════════════════════════════════════════════════════════════════════
  // STEP 2 — CLASS + SKILLS + BACKGROUND
  // ══════════════════════════════════════════════════════════════════════════
  const _renderClassStep = () => {
    const classGrid = CLASSES.map(cls => {
      const sel = _draft.classId === cls.id ? 'selected' : '';
      return `
        <div class="class-card ${sel}" data-class-id="${cls.id}">
          <div class="class-icon">${cls.icon}</div>
          <div class="class-name">${cls.name}</div>
          <div style="font-size:0.72rem;color:var(--text-dim);margin-top:0.15rem">${cls.hitDie}</div>
        </div>`;
    }).join('');

    const skillSection = _draft.classId ? _renderSkillPicker() : '';

    const bgGrid = BACKGROUNDS.map(bg => {
      const sel = _draft.bgId === bg.id ? 'selected' : '';
      return `
        <div class="class-card ${sel}" data-bg-id="${bg.id}" style="min-width:110px">
          <div class="class-icon">${bg.icon}</div>
          <div class="class-name" style="font-size:0.82rem">${bg.name}</div>
          <div style="font-size:0.68rem;color:var(--text-dim);margin-top:2px">${bg.skillLabels}</div>
        </div>`;
    }).join('');

    return `
      <div class="wizard-step active">
        <div class="wizard-step-title">Etapa 2 de ${TOTAL_STEPS}</div>
        <h2>Classe & Antecedente</h2>

        <h3 style="margin-bottom:0.5rem;font-size:0.95rem;color:var(--text-muted)">Classe</h3>
        <div class="class-grid">${classGrid}</div>

        <div id="skill-picker-container" style="margin-top:1rem">${skillSection}</div>

        <hr class="divider" style="margin:1.25rem 0">
        <h3 style="margin-bottom:0.5rem;font-size:0.95rem;color:var(--text-muted)">Antecedente</h3>
        <p class="text-muted mb-1" style="font-size:0.85rem">Fornece 2 perícias fixas adicionais.</p>
        <div class="class-grid" id="bg-grid">${bgGrid}</div>
      </div>`;
  };

  const _renderSkillPicker = () => {
    const cls = _draft.classObj;
    if (!cls) return '';
    const pool = cls.skillPool === 'any' ? ALL_SKILLS : cls.skillPool;
    const count = cls.skillCount;
    const checkboxes = pool.map(sid => {
      const checked = _draft.selectedSkills.includes(sid);
      const disabled = !checked && _draft.selectedSkills.length >= count;
      return `
        <label class="choosable-check-label ${checked?'selected':''}" style="min-width:160px">
          <input type="checkbox" data-skill-pick="${sid}" ${checked?'checked':''} ${disabled?'disabled':''}>
          ${SKILL_LABELS[sid]||sid}
        </label>`;
    }).join('');
    return `
      <div class="choosable-bonus-section" style="border-color:var(--border-gold)">
        <p>Escolha <strong>${count}</strong> perícia${count>1?'s':''} da lista do ${cls.name}
          (${_draft.selectedSkills.length}/${count} selecionadas)</p>
        <div class="choosable-checkboxes" id="skill-checkboxes">${checkboxes}</div>
      </div>`;
  };

  // ══════════════════════════════════════════════════════════════════════════
  // STEP 3 — ATTRIBUTES (Standard Array / Point Buy)
  // ══════════════════════════════════════════════════════════════════════════
  const _renderAttrStep = () => {
    const mode = _draft.attrMode;
    const modeToggle = `
      <div style="display:flex;gap:0.5rem;margin-bottom:1.25rem">
        <button class="btn ${mode==='standard'?'btn-primary':'btn-secondary'} btn-sm"
                id="mode-standard">📋 Matriz Padrão</button>
        <button class="btn ${mode==='pointbuy'?'btn-primary':'btn-secondary'} btn-sm"
                id="mode-pointbuy">🪙 Compra de Pontos</button>
      </div>`;

    const racialNote = _draft.race ? `
      <p style="font-size:0.82rem;color:var(--arcane-bright);margin-bottom:1rem">
        ✦ Bônus raciais: ${_raceBonusSummaryFull()}
      </p>` : '';

    let content = '';
    if (mode === 'standard') {
      content = _renderStandardArray();
    } else {
      content = _renderPointBuy();
    }

    return `
      <div class="wizard-step active">
        <div class="wizard-step-title">Etapa 3 de ${TOTAL_STEPS}</div>
        <h2>Distribuir Atributos</h2>
        ${modeToggle}
        ${racialNote}
        ${content}
      </div>`;
  };

  const _raceBonusSummaryFull = () => {
    const totals = {};
    Object.entries(_draft.race?.abilityBonuses || {}).forEach(([k,v]) => totals[k] = (totals[k]||0)+v);
    if (_draft.subrace) Object.entries(_draft.subrace.abilityBonuses || {}).forEach(([k,v]) => totals[k]=(totals[k]||0)+v);
    _draft.choosableBonuses.forEach(k => totals[k] = (totals[k]||0) + (_draft.race?.choosableBonus?.amount||1));
    return Object.entries(totals).map(([k,v])=>`${ATTR_LABELS[k]?.abbr||k} +${v}`).join(', ') || '—';
  };

  // Standard Array: drag/select each value into each attribute
  const _renderStandardArray = () => {
    const assigned = _draft.saAssigned; // { str: 15, dex: 14, ... }
    const usedValues = Object.values(assigned);
    const availableValues = STANDARD_ARRAY.filter(v => !usedValues.includes(v));

    const rows = Object.entries(ATTR_LABELS).map(([key, lbl]) => {
      const assigned_val = assigned[key];
      const racial = _getRacialBonus(key);
      const total  = (assigned_val || 0) + racial;
      const mod    = Math.floor((total - 10) / 2);
      const opts   = [
        `<option value="">—</option>`,
        ...STANDARD_ARRAY.map(v => {
          const taken = usedValues.includes(v) && assigned_val !== v;
          return `<option value="${v}" ${assigned_val===v?'selected':''} ${taken?'disabled':''}>${v}</option>`;
        })
      ].join('');
      return `
        <div class="attr-row">
          <div class="attr-label-block">
            <div class="lbl">${lbl.abbr}</div>
            <div class="full-name">${lbl.full}</div>
          </div>
          <div class="attr-number-block">
            <div style="font-size:0.6rem;color:var(--text-dim)">VALOR</div>
            <select class="sa-select" data-sa-key="${key}" style="width:60px;background:var(--bg-input);border:1px solid var(--border-gold);border-radius:var(--radius-sm);color:var(--text-primary);padding:0.3rem;font-family:var(--font-heading);font-size:0.95rem;text-align:center">${opts}</select>
          </div>
          <div class="attr-number-block">
            <div style="font-size:0.6rem;color:var(--text-dim)">RACIAL</div>
            <div class="attr-race-bonus">${racial !== 0 ? fmt.modifier(racial) : '—'}</div>
          </div>
          <div class="attr-number-block">
            <div style="font-size:0.6rem;color:var(--text-dim)">TOTAL</div>
            <div class="attr-total" id="attr-total-${key}">${assigned_val ? total : '—'}</div>
          </div>
          <div class="attr-number-block">
            <div style="font-size:0.6rem;color:var(--text-dim)">MOD</div>
            <div class="attr-mod" id="attr-mod-${key}">${assigned_val ? fmt.modifier(mod) : '—'}</div>
          </div>
        </div>`;
    }).join('');

    const remaining = STANDARD_ARRAY.filter(v => !usedValues.includes(v));
    const chips = STANDARD_ARRAY.map(v => {
      const used = usedValues.includes(v);
      return `<span style="display:inline-block;padding:2px 8px;border-radius:3px;font-family:var(--font-heading);font-size:0.82rem;border:1px solid ${used?'var(--text-dim)':'var(--gold)'};color:${used?'var(--text-dim)':'var(--gold)'};margin:2px;text-decoration:${used?'line-through':'none'}">${v}</span>`;
    }).join('');

    return `
      <div style="margin-bottom:0.75rem;font-size:0.85rem;color:var(--text-muted)">
        Atribua cada valor da matriz a um atributo:
      </div>
      <div style="margin-bottom:1rem">${chips}</div>
      <div class="attr-builder">${rows}</div>`;
  };

  // Point Buy
  const _renderPointBuy = () => {
    const attrs = _draft.attributes;
    const spent = Object.values(attrs).reduce((s,a) => s + (PB_COST[a.base]||0), 0);
    const remaining = PB_BUDGET - spent;

    const rows = Object.entries(ATTR_LABELS).map(([key, lbl]) => {
      const base   = attrs[key].base;
      const racial = _getRacialBonus(key);
      const total  = base + racial;
      const mod    = Math.floor((total - 10) / 2);
      const cost   = PB_COST[base] || 0;
      const canUp  = base < PB_MAX && remaining >= (PB_COST[base+1]||99) - cost;
      const canDown= base > PB_MIN;

      return `
        <div class="attr-row">
          <div class="attr-label-block">
            <div class="lbl">${lbl.abbr}</div><div class="full-name">${lbl.full}</div>
          </div>
          <div class="attr-number-block" style="flex-direction:row;gap:4px;align-items:center">
            <button class="cbtn pb-down" data-pb-key="${key}" ${canDown?'':'disabled'} style="width:24px;height:24px">−</button>
            <div style="font-family:var(--font-heading);font-size:1.2rem;color:var(--text-primary);min-width:24px;text-align:center">${base}</div>
            <button class="cbtn pb-up" data-pb-key="${key}" ${canUp?'':'disabled'} style="width:24px;height:24px">+</button>
          </div>
          <div class="attr-number-block">
            <div style="font-size:0.6rem;color:var(--text-dim)">CUSTO</div>
            <div style="color:var(--gold-dim);font-size:0.85rem">${cost}</div>
          </div>
          <div class="attr-number-block">
            <div style="font-size:0.6rem;color:var(--text-dim)">RACIAL</div>
            <div class="attr-race-bonus">${racial !== 0 ? fmt.modifier(racial) : '—'}</div>
          </div>
          <div class="attr-number-block">
            <div style="font-size:0.6rem;color:var(--text-dim)">TOTAL</div>
            <div class="attr-total" id="attr-total-${key}">${total}</div>
          </div>
          <div class="attr-number-block">
            <div style="font-size:0.6rem;color:var(--text-dim)">MOD</div>
            <div class="attr-mod" id="attr-mod-${key}">${fmt.modifier(mod)}</div>
          </div>
        </div>`;
    }).join('');

    const barPct = Math.min(100, (spent / PB_BUDGET) * 100);
    const barCol = remaining < 0 ? 'var(--crimson-bright)' : remaining === 0 ? 'var(--gold)' : 'var(--arcane-bright)';

    return `
      <div style="margin-bottom:1rem">
        <div style="display:flex;justify-content:space-between;font-size:0.85rem;margin-bottom:0.35rem">
          <span style="color:var(--text-muted)">Pontos gastos: <strong style="color:var(--gold)">${spent}</strong> / ${PB_BUDGET}</span>
          <span style="color:${remaining<0?'var(--crimson-bright)':'var(--text-muted)'}">Restantes: <strong>${remaining}</strong></span>
        </div>
        <div style="height:6px;background:var(--bg-input);border-radius:3px;overflow:hidden">
          <div style="height:100%;width:${barPct}%;background:${barCol};transition:width 0.2s;border-radius:3px"></div>
        </div>
        <div style="font-size:0.75rem;color:var(--text-dim);margin-top:0.35rem">
          Valores permitidos: ${PB_MIN}–${PB_MAX} (antes dos bônus raciais)
        </div>
      </div>
      <div class="attr-builder" id="pb-builder">${rows}</div>`;
  };

  // ══════════════════════════════════════════════════════════════════════════
  // STEP 4 — EQUIPMENT
  // ══════════════════════════════════════════════════════════════════════════
  const _renderEquipStep = () => {
    const cls = _draft.classObj;
    if (!cls) return '<p class="text-muted">Selecione uma classe primeiro.</p>';

    const sg = cls.startingGold;
    const goldLabel = `${sg.dice}d${sg.sides}×${sg.mult} PO`;

    const optA = cls.equipment.optionA;
    const optB = cls.equipment.optionB;

    const makeItemList = (items) => items.map(i =>
      `<li style="font-size:0.82rem;color:var(--text-muted);margin-bottom:2px">
        ${i.qty > 1 ? `×${i.qty} ` : ''}${i.name}${i.desc ? ` <em style="color:var(--text-dim)">(${i.desc.split(',')[0]})</em>` : ''}
      </li>`
    ).join('');

    const optCard = (id, label, items, armorAC, current) => `
      <div class="equip-option ${current===id?'equip-selected':''}" data-equip="${id}"
           style="border:1px solid ${current===id?'var(--gold)':'var(--border-faint)'};border-radius:var(--radius-sm);padding:1rem;cursor:pointer;transition:var(--transition);background:${current===id?'rgba(212,175,55,0.06)':'var(--bg-card)'};margin-bottom:0.75rem">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.5rem">
          <strong style="font-family:var(--font-heading);font-size:0.85rem;color:${current===id?'var(--gold)':'var(--text-primary)'}">${label}</strong>
          ${armorAC ? `<span class="badge badge-gold">CA ${armorAC}</span>` : '<span class="badge" style="border-color:var(--border-faint);color:var(--text-dim)">Sem armadura</span>'}
        </div>
        <ul style="margin:0;padding-left:1rem;list-style:disc">${makeItemList(items)}</ul>
      </div>`;

    const goldCard = `
      <div class="equip-option ${_draft.equipChoice==='gold'?'equip-selected':''}" data-equip="gold"
           style="border:1px solid ${_draft.equipChoice==='gold'?'var(--gold)':'var(--border-faint)'};border-radius:var(--radius-sm);padding:1rem;cursor:pointer;transition:var(--transition);background:${_draft.equipChoice==='gold'?'rgba(212,175,55,0.06)':'var(--bg-card)'};margin-bottom:0.75rem">
        <strong style="font-family:var(--font-heading);font-size:0.85rem;color:${_draft.equipChoice==='gold'?'var(--gold)':'var(--text-primary)'}">💰 Ouro Inicial — ${goldLabel}</strong>
        <p style="font-size:0.82rem;color:var(--text-muted);margin-top:0.35rem">Você recebe ouro para comprar equipamento livremente.</p>
      </div>`;

    return `
      <div class="wizard-step active">
        <div class="wizard-step-title">Etapa 4 de ${TOTAL_STEPS}</div>
        <h2>Equipamento Inicial</h2>
        <p class="text-muted mb-2" style="font-size:0.9rem">Escolha o pacote inicial do ${cls.name} ou receba ouro inicial.</p>
        ${optCard('A', optA.label, optA.items, optA.armorAC, _draft.equipChoice)}
        ${optCard('B', optB.label, optB.items, optB.armorAC, _draft.equipChoice)}
        ${goldCard}
        <p style="font-size:0.78rem;color:var(--text-dim);margin-top:0.5rem">
          Proficiências de armadura: ${cls.armorProf} · Armas: ${cls.weaponProf}
        </p>
      </div>`;
  };

  // ══════════════════════════════════════════════════════════════════════════
  // STEP 5 — DETAILS
  // ══════════════════════════════════════════════════════════════════════════
  const _renderDetailsStep = () => {
    const d = _draft.details;
    const alignments = ['Leal e Bom','Neutro e Bom','Caótico e Bom','Leal e Neutro','Neutro','Caótico e Neutro','Leal e Mau','Neutro e Mau','Caótico e Mau'];
    const alignOpts = alignments.map(a => `<option ${d.alignment===a?'selected':''}>${a}</option>`).join('');

    // Compute all proficient skills for summary
    const allProf = _allProficientSkills();

    return `
      <div class="wizard-step active">
        <div class="wizard-step-title">Etapa 5 de ${TOTAL_STEPS}</div>
        <h2>Detalhes Finais</h2>
        <div class="form-group mt-2">
          <label>Nome do Personagem *</label>
          <input type="text" class="form-control" id="wiz-name" value="${d.name}" placeholder="Ex.: Faenor Montclair">
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Nível Inicial</label>
            <input type="number" class="form-control" id="wiz-level" value="${d.level}" min="1" max="20">
          </div>
          <div class="form-group">
            <label>Alinhamento</label>
            <select class="form-control" id="wiz-alignment">
              <option value="">Selecionar...</option>${alignOpts}
            </select>
          </div>
        </div>
        <div class="form-group">
          <label>Nome do Jogador</label>
          <input type="text" class="form-control" id="wiz-player" value="${d.playerName}" placeholder="Seu nome">
        </div>

        <div class="card mt-2" style="border-color:var(--border-gold);font-size:0.88rem">
          <div class="card-title">Resumo do Personagem</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem 1rem;color:var(--text-muted)">
            <div>Raça: <strong style="color:var(--text-primary)">${_fullRaceName()}</strong></div>
            <div>Classe: <strong style="color:var(--text-primary)">${_draft.classObj?.name||'—'}</strong></div>
            <div>Antecedente: <strong style="color:var(--text-primary)">${_draft.bgObj?.name||'—'}</strong></div>
            <div>Equipamento: <strong style="color:var(--text-primary)">${_draft.equipChoice==='gold'?'Ouro Inicial':'Pacote '+_draft.equipChoice}</strong></div>
          </div>
          <div style="margin-top:0.75rem;color:var(--text-muted)">
            Perícias: <span style="color:var(--text-primary)">${allProf.map(s=>SKILL_LABELS[s]||s).join(', ') || '—'}</span>
          </div>
        </div>
      </div>`;
  };

  // ══════════════════════════════════════════════════════════════════════════
  // HELPERS
  // ══════════════════════════════════════════════════════════════════════════
  const _getRacialBonus = (attrKey) => {
    let bonus = _draft.race?.abilityBonuses?.[attrKey] || 0;
    if (_draft.subrace) bonus += _draft.subrace.abilityBonuses?.[attrKey] || 0;
    const cb = _draft.race?.choosableBonus;
    if (cb && _draft.choosableBonuses.includes(attrKey)) bonus += cb.amount;
    return bonus;
  };

  const _fullRaceName = () => {
    if (!_draft.race) return '—';
    return _draft.subrace ? `${_draft.race.name} (${_draft.subrace.name})` : _draft.race.name;
  };

  const _allProficientSkills = () => {
    const set = new Set();
    (_draft.selectedSkills || []).forEach(s => set.add(s));
    (_draft.bgObj?.skills || []).forEach(s => set.add(s));
    (_draft.race?.racialSkills || []).forEach(s => set.add(s));
    (_draft.subrace?.proficiencies || []).filter(s => ALL_SKILLS.includes(s)).forEach(s => set.add(s));
    return [...set];
  };

  const _getEffectiveAttrs = () => {
    const result = {};
    Object.keys(ATTR_LABELS).forEach(k => {
      const base = _draft.attrMode === 'standard'
        ? (_draft.saAssigned[k] || 8)
        : _draft.attributes[k].base;
      result[k] = { base, racialBonus: _getRacialBonus(k) };
    });
    return result;
  };

  // ══════════════════════════════════════════════════════════════════════════
  // NAVIGATION & VALIDATION
  // ══════════════════════════════════════════════════════════════════════════
  const _nextStep = () => {
    if (!_validateStep()) return;
    if (_step === TOTAL_STEPS) { _finalize(); return; }
    _step++;
    _render();
  };

  const _prevStep = () => {
  if (_step === 1) {
    window.dispatchEvent(new CustomEvent('navigate-home'));
  } else {
    _step--; 
    _render(); 
  }
};

  const _validateStep = () => {
    switch (_step) {
      case 1: {
        if (!_draft.raceId) { Toast.show('Selecione uma raça.'); return false; }
        if (_draft.race?.subraces?.length && !_draft.subraceId) {
          Toast.show('Selecione uma sub-raça.'); return false;
        }
        if (_draft.race?.choosableBonus && !_draft.race?.subraces) {
          const needed = _draft.race.choosableBonus.count;
          if (_draft.choosableBonuses.length !== needed) {
            Toast.show(`Selecione exatamente ${needed} atributo(s) para o bônus racial.`); return false;
          }
        }
        return true;
      }
      case 2: {
        if (!_draft.classId) { Toast.show('Selecione uma classe.'); return false; }
        const needed = _draft.classObj?.skillCount || 0;
        if (_draft.selectedSkills.length !== needed) {
          Toast.show(`Selecione exatamente ${needed} perícia(s) de classe.`); return false;
        }
        if (!_draft.bgId) { Toast.show('Selecione um antecedente.'); return false; }
        return true;
      }
      case 3: {
        if (_draft.attrMode === 'standard') {
          const assigned = Object.values(_draft.saAssigned).filter(Boolean);
          if (assigned.length < 6) { Toast.show('Atribua todos os 6 valores da matriz.'); return false; }
        } else {
          const spent = Object.values(_draft.attributes).reduce((s,a) => s+(PB_COST[a.base]||0), 0);
          if (spent > PB_BUDGET) { Toast.show('Pontos excedidos! Reduza alguns atributos.'); return false; }
          const overMax = Object.values(_draft.attributes).some(a => a.base > PB_MAX);
          if (overMax) { Toast.show(`Valor base máximo é ${PB_MAX} (antes dos bônus raciais).`); return false; }
        }
        return true;
      }
      case 4: {
        if (!_draft.equipChoice) { Toast.show('Escolha uma opção de equipamento.'); return false; }
        return true;
      }
      case 5: {
        const name = document.getElementById('wiz-name')?.value.trim();
        if (!name) { Toast.show('O nome do personagem é obrigatório.'); return false; }
        _draft.details.name       = name;
        _draft.details.level      = parseInt(document.getElementById('wiz-level')?.value) || 1;
        _draft.details.alignment  = document.getElementById('wiz-alignment')?.value || '';
        _draft.details.playerName = document.getElementById('wiz-player')?.value.trim() || '';
        return true;
      }
    }
    return true;
  };

  // ══════════════════════════════════════════════════════════════════════════
  // FINALIZE — commit to CharacterState
  // ══════════════════════════════════════════════════════════════════════════
  const _finalize = () => {
    const cls  = _draft.classObj;
    const race = _draft.race;
    const lvl  = _draft.details.level;
    const attrs = _getEffectiveAttrs();

    // ── HP ──
    const conTotal = attrs.con.base + attrs.con.racialBonus;
    const conMod   = Math.floor((conTotal - 10) / 2);
    const hitDieMax = parseInt((cls?.hitDie||'d8').replace('d','')) || 8;
    const levelOneHP = Math.max(1, hitDieMax + conMod);
    const maxHP = lvl <= 1
      ? levelOneHP
      : levelOneHP + ((lvl - 1) * (Math.floor(hitDieMax / 2) + 1 + conMod));

    // ── Initiative ──
    const dexTotal = attrs.dex.base + attrs.dex.racialBonus;
    const dexMod   = Math.floor((dexTotal - 10) / 2);

    // ── AC (armour-aware) ──
    let ac = 10 + dexMod;  // unarmored default
    if (_draft.equipChoice !== 'gold') {
      const equip = cls?.equipment[_draft.equipChoice === 'A' ? 'optionA' : 'optionB'];
      if (equip?.armorAC) {
        // If heavy (no DEX) → flat; if medium → +DEX capped 2; if light → +DEX full
        // We infer by armorAC value: ≥16 → heavy (flat); 14-15 → medium (capped 2); <14 → light (full)
        if (equip.armorAC >= 16) {
          ac = equip.armorAC;
        } else if (equip.armorAC >= 14) {
          ac = equip.armorAC + Math.min(dexMod, 2);
        } else {
          ac = equip.armorAC + dexMod;
        }
        // Add shield if present
        const hasShield = (equip.items || []).some(i => i.name.toLowerCase().includes('escudo'));
        if (hasShield) ac += 2;
      }
    }

    // ── Skills (race + class + background, deduplicated) ──
    const allSkills = _allProficientSkills();

    // ── Inventory & Coins ──
    const EMPTY_INV = { 'Equipamentos':[],'Armas':[],'Poções':[],'Acessórios':[],'Utilizáveis':[] };
    const inv = JSON.parse(JSON.stringify(EMPTY_INV));
    const coins = { pp:0, po:0, pe:0, pa:0, pc:0 };

    if (_draft.equipChoice === 'gold') {
      // Roll starting gold (average)
      const sg = cls.startingGold;
      const avgRoll = Math.ceil(sg.dice * (sg.sides + 1) / 2);
      coins.po = avgRoll * sg.mult;
    } else {
      const equip = cls.equipment[_draft.equipChoice === 'A' ? 'optionA' : 'optionB'];
      (equip.items || []).forEach(i => {
        const cat = i.cat || 'Equipamentos';
        if (inv[cat]) {
          inv[cat].push({
            id:       `item_${Date.now()}_${Math.random().toString(36).slice(2,6)}`,
            name:     i.name, type: i.type||'Outros',
            qty:      i.qty||1, status: i.status||'Normal',
            desc:     i.desc||'', img: null,
            wDmgType: i.wDmgType||'', wDice: i.wDice||'',
            wRange:   i.wRange||'', wAtk: i.wAtk||'', wProps: i.wProps||''
            ,weight: 0,
            equipped: (i.status || '').toLowerCase() === 'equipado'
          });
        }
      });
    }

    // ── Proficiency text ──
    const profText = {
      armor:     cls?.armorProf  || '',
      weapons:   cls?.weaponProf || '',
      tools:     '',
      languages: [...(race?.languages||['Comum']),
                  ...(_draft.subrace ? [] : [])].join(', ')
    };

    const wisMod = Math.floor(((attrs.wis.base + attrs.wis.racialBonus) - 10) / 2);
    const profBonus = Math.ceil(lvl / 4) + 1;
    const passivePerception = 10 + wisMod + (allSkills.includes('perception') ? profBonus : 0);

    CharacterState.patch({
      identity: {
        name:       _draft.details.name,
        race:       _fullRaceName(),
        raceId:     _draft.raceId,
        class:      cls?.name || '',
        level:      lvl,
        background: _draft.bgObj?.name || '',
        alignment:  _draft.details.alignment,
        playerName: _draft.details.playerName,
        xp:         0
      },
      attributes: attrs,
      combat: {
        hp:          { current: maxHP, max: maxHP, temp: 0 },
        ac,
        initiative:  dexMod,
        speed:       _draft.subrace?.speed || race?.speed || 9,
        hitDice:     `${lvl}${cls?.hitDie||'d8'}`,
        hitDicePool: { total: lvl, spent: 0, die: hitDieMax },
        passivePerception,
        deathSaves:  { successes:[false,false,false], failures:[false,false,false] }
      },
      savingThrows:  { proficient: cls?.saves || [] },
      skills:        { proficient: allSkills, expertise: [] },
      proficiencies: profText,
      inventory:     inv,
      coins,
      progression: {
        classId: cls?.id || '',
        hitDie: hitDieMax,
        attacks: []
      }
    });

    Toast.show(`✦ ${_draft.details.name} criado com sucesso!`);
    window.dispatchEvent(new CustomEvent('wizard-complete'));
  };

  // ══════════════════════════════════════════════════════════════════════════
  // STEP LISTENERS
  // ══════════════════════════════════════════════════════════════════════════
  const _attachStepListeners = () => {
    if (_step === 1) _attachStep1();
    if (_step === 2) _attachStep2();
    if (_step === 3) _attachStep3();
    if (_step === 4) _attachStep4();
  };

  // ── Step 1 listeners ──────────────────────────────────────────────────
  const _attachStep1 = () => {
    document.querySelectorAll('.race-card[data-race-id]').forEach(card => {
      card.addEventListener('click', () => {
        const raceId = card.dataset.raceId;
        _draft.raceId = raceId;
        _draft.race   = _races.find(r => r.id === raceId);
        _draft.subraceId = null; _draft.subrace = null;
        _draft.choosableBonuses = [];
        document.querySelectorAll('.race-card[data-race-id]').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');

        const subCont = document.getElementById('subrace-container');
        const cbCont  = document.getElementById('choosable-bonus-container');
        if (subCont) subCont.innerHTML = _draft.race?.subraces ? _renderSubraceSection() : '';
        if (cbCont)  cbCont.innerHTML  = _draft.race?.choosableBonus && !_draft.race?.subraces ? _renderChoosableBonus() : '';
        _attachSubraceListeners();
        _attachChoosableListeners();
      });
    });
    _attachSubraceListeners();
    _attachChoosableListeners();
  };

  const _attachSubraceListeners = () => {
    document.querySelectorAll('[data-subrace-id]').forEach(card => {
      card.addEventListener('click', () => {
        const sr = _draft.race?.subraces?.find(s => s.id === card.dataset.subraceId);
        _draft.subraceId = card.dataset.subraceId;
        _draft.subrace   = sr || null;
        document.querySelectorAll('[data-subrace-id]').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        card.style.borderColor = 'var(--arcane-bright)';
      });
    });
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
            Toast.show(`Escolha apenas ${cb.count} atributo(s).`); return;
          }
          _draft.choosableBonuses.push(key);
        } else {
          _draft.choosableBonuses = _draft.choosableBonuses.filter(k => k !== key);
        }
        chk.closest('.choosable-check-label')?.classList.toggle('selected', chk.checked);
        const p = chk.closest('.choosable-bonus-section')?.querySelector('p');
        if (p) p.textContent = `${cb.description} (${_draft.choosableBonuses.length}/${cb.count} selecionados)`;
      });
    });
  };

  // ── Step 2 listeners ──────────────────────────────────────────────────
  const _attachStep2 = () => {
    document.querySelectorAll('.class-card[data-class-id]').forEach(card => {
      card.addEventListener('click', () => {
        _draft.classId  = card.dataset.classId;
        _draft.classObj = CLASSES.find(c => c.id === _draft.classId);
        _draft.selectedSkills = [];
        document.querySelectorAll('.class-card[data-class-id]').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        const container = document.getElementById('skill-picker-container');
        if (container) { container.innerHTML = _renderSkillPicker(); _attachSkillPickListeners(); }
      });
    });

    document.querySelectorAll('.class-card[data-bg-id]').forEach(card => {
      card.addEventListener('click', () => {
        _draft.bgId  = card.dataset.bgId;
        _draft.bgObj = BACKGROUNDS.find(b => b.id === _draft.bgId);
        document.querySelectorAll('.class-card[data-bg-id]').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
      });
    });

    _attachSkillPickListeners();
  };

  const _attachSkillPickListeners = () => {
    document.querySelectorAll('[data-skill-pick]').forEach(chk => {
      chk.addEventListener('change', () => {
        const sid   = chk.dataset.skillPick;
        const count = _draft.classObj?.skillCount || 0;
        if (chk.checked) {
          if (_draft.selectedSkills.length >= count) {
            chk.checked = false;
            Toast.show(`Escolha apenas ${count} perícia(s).`); return;
          }
          _draft.selectedSkills.push(sid);
        } else {
          _draft.selectedSkills = _draft.selectedSkills.filter(s => s !== sid);
        }
        chk.closest('.choosable-check-label')?.classList.toggle('selected', chk.checked);
        const p = chk.closest('.choosable-bonus-section')?.querySelector('p');
        if (p) p.innerHTML = `Escolha <strong>${count}</strong> perícia${count>1?'s':''} da lista do ${_draft.classObj?.name} (${_draft.selectedSkills.length}/${count} selecionadas)`;
        // Re-disable unchosen if at cap
        document.querySelectorAll('[data-skill-pick]').forEach(c => {
          if (!c.checked) c.disabled = _draft.selectedSkills.length >= count;
        });
      });
    });
  };

  // ── Step 3 listeners ──────────────────────────────────────────────────
  const _attachStep3 = () => {
    // Mode toggle
    document.getElementById('mode-standard')?.addEventListener('click', () => {
      _draft.attrMode = 'standard'; _render();
    });
    document.getElementById('mode-pointbuy')?.addEventListener('click', () => {
      _draft.attrMode = 'pointbuy'; _render();
    });

    // Standard array selects
    document.querySelectorAll('.sa-select').forEach(sel => {
      sel.addEventListener('change', () => {
        const key = sel.dataset.saKey;
        const val = parseInt(sel.value) || null;
        _draft.saAssigned[key] = val;
        // Sync attributes for _getEffectiveAttrs
        if (val) _draft.attributes[key] = { base: val };
        _renderStandardArray_refresh();
      });
    });

    // Point buy buttons
    document.querySelectorAll('.pb-up').forEach(btn => {
      btn.addEventListener('click', () => {
        const k = btn.dataset.pbKey;
        const cur = _draft.attributes[k].base;
        if (cur < PB_MAX) {
          const newVal = cur + 1;
          const spent = Object.values(_draft.attributes).reduce((s,a)=>s+(PB_COST[a.base]||0),0);
          const addCost = (PB_COST[newVal]||0) - (PB_COST[cur]||0);
          if (spent + addCost <= PB_BUDGET) {
            _draft.attributes[k].base = newVal;
            _renderPB_refresh();
          } else { Toast.show('Pontos insuficientes.'); }
        }
      });
    });
    document.querySelectorAll('.pb-down').forEach(btn => {
      btn.addEventListener('click', () => {
        const k = btn.dataset.pbKey;
        if (_draft.attributes[k].base > PB_MIN) {
          _draft.attributes[k].base--;
          _renderPB_refresh();
        }
      });
    });
  };

  // Refresh Standard Array display without full re-render
  const _renderStandardArray_refresh = () => {
    const card = document.getElementById('wizard-card');
    if (!card) return;
    card.innerHTML = _renderAttrStep();
    _attachStep3();
  };

  // Refresh Point Buy display without full re-render
  const _renderPB_refresh = () => {
    const card = document.getElementById('wizard-card');
    if (!card) return;
    card.innerHTML = _renderAttrStep();
    _attachStep3();
  };

  // ── Step 4 listeners ──────────────────────────────────────────────────
  const _attachStep4 = () => {
    document.querySelectorAll('.equip-option').forEach(el => {
      el.addEventListener('click', () => {
        _draft.equipChoice = el.dataset.equip;
        const card = document.getElementById('wizard-card');
        if (card) { card.innerHTML = _renderEquipStep(); _attachStep4(); }
      });
    });
  };

  return { init };
})();
