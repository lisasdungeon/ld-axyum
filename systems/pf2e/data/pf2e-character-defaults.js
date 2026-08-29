/**
 * PF2E_CHARACTER_DEFAULTS - Default wizard character data shape for PF2e.
 * Deliberately independent of core/character-defaults.js (dnd5e's shape) —
 * boosts/flaws and proficiency ranks don't map onto point-buy/proficient-booleans.
 */

export const PF2E_CHARACTER_DEFAULTS = {
  name: '',
  level: 1,

  ancestry: { id: '', name: '', hp: 0, size: 'med', speed: 25, traits: [], boosts: [], flaws: [] },
  heritage: { id: '', name: '' },
  background: { id: '', name: '', boosts: [], trainedSkill: '', loreSkill: '' },
  class: { id: '', name: '', keyAbility: '', keyAbilityOptions: [], hpPerLevel: 8, spellcasting: null },

  abilityBoosts: {
    ancestry: [],
    background: '',
    class: '',
    free: ['', '', '', '']
  },

  // Final resolved ability scores (computed from boosts, not assigned directly)
  abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },

  proficiencies: {
    perception: 'untrained',
    saves: { fortitude: 'untrained', reflex: 'untrained', will: 'untrained' },
    classDC: 'trained',
    skills: {},
    weapons: {},
    armor: {}
  },

  feats: {
    ancestry: [],
    class: [],
    skill: [],
    general: [],
    bonus: []
  },

  languages: [],

  equipment: {
    selectedIds: [],
    currency: { cp: 0, sp: 0, gp: 15, pp: 0 }
  },

  spells: {
    selectedCantrips: [],
    selectedSpells: {}
  },

  hitPoints: { ancestryHP: 0, classHP: 0, conBonus: 0, max: 0, current: 0 },

  details: {
    deity: '',
    edicts: '',
    anathema: '',
    age: '',
    height: '',
    weight: '',
    appearance: '',
    backstory: '',
    portrait: ''
  },

  proficiencyWithoutLevel: false
};
