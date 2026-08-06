/**
 * LD Axyum - Character Default Data Structure
 * 
 * Default character data structure for D&D 5e characters.
 * Extracted from character-model.js for LD protocol compliance.
 * 
 * Supports both single-class (Phase 2) and multi-class (Phase 3a) characters.
 * Includes all core attributes, abilities, skills, equipment, spells, and resources.
 */

export const CHARACTER_DEFAULTS = {
  // ===== CORE IDENTITY =====
  name: '',
  playerName: '',
  role: null,
  alignment: 'NG',
  experiencePoints: 0,
  inspiration: false,
  
  // Physical Characteristics
  age: 0,
  height: '',
  weight: '',
  eyes: '',
  skin: '',
  hair: '',
  physicalDescription: '',
  
  // Phase 2: Single class (backward compatibility)
  class: {
    id: null,
    name: null,
    subclass: null,
    level: 1,
    spellcastingAbility: null,
    hitDie: 'd8'
  },
  
  // Phase 3a: Multiple classes array
  classes: [],
  isMulticlass: false,
  totalLevel: 1,
  
  race: {
    id: null,
    name: null,
    subrace: null,
    culture: null,
    speed: 30,
    size: 'med',
    senses: [] // darkvision, etc.
  },
  
  background: {
    id: null,
    name: null,
    feature: ''
  },
  
  // ===== ABILITY SCORES =====
  abilities: {
    str: 10,
    dex: 10,
    con: 10,
    int: 10,
    wis: 10,
    cha: 10
  },
  
  savingThrows: {
    str: { proficient: false, bonus: 0 },
    dex: { proficient: false, bonus: 0 },
    con: { proficient: false, bonus: 0 },
    int: { proficient: false, bonus: 0 },
    wis: { proficient: false, bonus: 0 },
    cha: { proficient: false, bonus: 0 }
  },
  
  // ===== SKILLS & PROFICIENCIES =====
  skillProficiencies: [],
  skills: {
    acrobatics: { proficient: false, expertise: false },
    animalHandling: { proficient: false, expertise: false },
    arcana: { proficient: false, expertise: false },
    athletics: { proficient: false, expertise: false },
    deception: { proficient: false, expertise: false },
    history: { proficient: false, expertise: false },
    insight: { proficient: false, expertise: false },
    intimidation: { proficient: false, expertise: false },
    investigation: { proficient: false, expertise: false },
    medicine: { proficient: false, expertise: false },
    nature: { proficient: false, expertise: false },
    perception: { proficient: false, expertise: false },
    performance: { proficient: false, expertise: false },
    persuasion: { proficient: false, expertise: false },
    religion: { proficient: false, expertise: false },
    sleightOfHand: { proficient: false, expertise: false },
    stealth: { proficient: false, expertise: false },
    survival: { proficient: false, expertise: false }
  },
  
  passivePerception: 10,
  passiveInsight: 10,
  passiveInvestigation: 10,
  
  proficiencies: {
    armor: [],
    weapons: [],
    tools: [],
    instruments: [],
    languages: []
  },
  
  // ===== COMBAT & DEFENSES =====
  armorClass: 10,
  initiative: 0,
  speed: {
    walk: 30,
    swim: 0,
    fly: 0,
    burrow: 0,
    climb: 0
  },
  
  hitPoints: {
    max: 0,
    current: 0,
    temp: 0
  },
  
  hitDice: {
    total: 1,
    remaining: 1,
    type: 'd8'
  },
  
  deathSaves: {
    successes: 0,
    failures: 0
  },
  
  // ===== ATTACKS & SPELLCASTING =====
  attacks: [],
  
  spellcasting: {
    class: null,
    ability: null,
    saveDC: 8,
    attackBonus: 0
  },
  
  // ===== RESOURCES & CONDITIONS =====
  resources: {
    // Class-specific resources
    sorceryPoints: { max: 0, current: 0 },
    kiPoints: { max: 0, current: 0 },
    rageUses: { max: 0, current: 0 },
    superiorityDice: { max: 0, current: 0, type: 'd8' },
    wildShape: { max: 0, current: 0 },
    channelDivinity: { max: 0, current: 0 },
    layOnHands: { max: 0, current: 0 },
    infusions: { max: 0, current: 0 },
    bardInspiration: { max: 0, current: 0, type: 'd6' },
    actionSurge: { max: 0, current: 0 },
    secondWind: { max: 0, current: 0 },
    custom: [] // For other class resources
  },
  
  attunement: {
    max: 3,
    current: []
  },
  
  exhaustion: 0,
  conditions: [],
  concentration: null,
  
  // ===== FEATURES & TRAITS =====
  racialTraits: [],
  classFeatures: [],
  subclassFeatures: [],
  feats: [],
  backgroundFeature: null,
  
  // ===== PERSONALITY =====
  personality: {
    traits: '',
    ideals: '',
    bonds: '',
    flaws: '',
    backstory: '',
    alliesOrganizations: ''
  },
  
  // Equipment IDs selected during wizard creation
  selectedEquipmentIds: [],
  startingPackageId: null,
  startingPackageChoices: {},
  chooseASI: false,

  // ===== EQUIPMENT & TREASURE =====
  equipment: {
    armor: null,
    shield: null,
    mainHand: null,
    offHand: null,
    gear: [],
    magicItems: [],
    containers: []
  },
  
  currency: {
    cp: 0,
    sp: 0,
    ep: 0,
    gp: 0,
    pp: 0
  },
  
  carryingCapacity: {
    current: 0,
    max: 150,
    encumbered: false,
    heavilyEncumbered: false
  },
  
  // ===== SPELLS =====
  // Spell IDs selected during wizard creation
  selectedCantrips: [],
  selectedSpells: [],
  
  spells: {
    prepared: [],
    known: [],
    cantrips: []
  },
  
  spellSlots: {
    1: { max: 0, expended: 0 },
    2: { max: 0, expended: 0 },
    3: { max: 0, expended: 0 },
    4: { max: 0, expended: 0 },
    5: { max: 0, expended: 0 },
    6: { max: 0, expended: 0 },
    7: { max: 0, expended: 0 },
    8: { max: 0, expended: 0 },
    9: { max: 0, expended: 0 }
  },
  
  materialComponents: [],
  
  // ===== ADDITIONAL DETAILS =====
  details: {
    biography: '',
    appearance: '',
    traits: '',
    ideals: '',
    bonds: '',
    flaws: '',
    alignment: 'NG'
  }
};
