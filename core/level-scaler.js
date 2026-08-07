/**
 * LevelScaler
 * 
 * Handles level-based stat calculations for D&D 5e character progression
 * - HP calculation per level with class hit die
 * - Proficiency bonus based on level
 * - Ability Score Improvement (ASI) tracking
 * - Spell slot progression for casters
 * - Class feature milestones
 */

class LevelScaler {
  constructor() {
    // Hit die sizes per class
    this.classHitDice = {
      'barbarian': 12,
      'bard': 8,
      'cleric': 8,
      'druid': 8,
      'fighter': 10,
      'monk': 8,
      'paladin': 10,
      'ranger': 10,
      'rogue': 8,
      'sorcerer': 6,
      'warlock': 8,
      'wizard': 6
    };

    // Spell slot progression by class and level
    this.spellSlotProgression = {
      'full-caster': {
        1: [2],
        2: [3],
        3: [4, 2],
        4: [4, 3],
        5: [4, 3, 2],
        6: [4, 3, 3],
        7: [4, 3, 3, 1],
        8: [4, 3, 3, 2],
        9: [4, 3, 3, 3, 1],
        10: [4, 3, 3, 3, 2],
        11: [4, 3, 3, 3, 2, 1],
        12: [4, 3, 3, 3, 2, 1],
        13: [4, 3, 3, 3, 2, 1, 1],
        14: [4, 3, 3, 3, 2, 1, 1],
        15: [4, 3, 3, 3, 2, 1, 1, 1],
        16: [4, 3, 3, 3, 2, 1, 1, 1],
        17: [4, 3, 3, 3, 2, 1, 1, 1, 1],
        18: [4, 3, 3, 3, 3, 1, 1, 1, 1],
        19: [4, 3, 3, 3, 3, 2, 1, 1, 1],
        20: [4, 3, 3, 3, 3, 2, 2, 1, 1]
      },
      'half-caster': {
        1: [],
        2: [],
        3: [2],
        4: [2],
        5: [3, 2],
        6: [3, 2],
        7: [3, 3],
        8: [3, 3],
        9: [3, 3, 2],
        10: [3, 3, 2],
        11: [3, 3, 3],
        12: [3, 3, 3],
        13: [3, 3, 3, 1],
        14: [3, 3, 3, 1],
        15: [3, 3, 3, 2],
        16: [3, 3, 3, 2],
        17: [3, 3, 3, 3, 1],
        18: [3, 3, 3, 3, 1],
        19: [3, 3, 3, 3, 2],
        20: [3, 3, 3, 3, 2]
      },
      'third-caster': {
        1: [],
        2: [],
        3: [2],
        4: [2],
        5: [2],
        6: [2],
        7: [3],
        8: [3],
        9: [3, 2],
        10: [3, 2],
        11: [3, 2],
        12: [3, 2],
        13: [3, 3],
        14: [3, 3],
        15: [3, 3, 1],
        16: [3, 3, 1],
        17: [3, 3, 2],
        18: [3, 3, 2],
        19: [3, 3, 3],
        20: [3, 3, 3]
      }
    };

    // Class spell progression types
    this.classSpellProgression = {
      'bard': 'full-caster',
      'cleric': 'full-caster',
      'druid': 'full-caster',
      'sorcerer': 'full-caster',
      'wizard': 'full-caster',
      'paladin': 'half-caster',
      'ranger': 'half-caster',
      'warlock': 'warlock' // Special case
    };

    // ASI levels for all classes
    this.asiLevels = [4, 8, 12, 16, 19];
  }

  /**
   * Calculate HP for a given level
   * Assumes CON modifier is provided
   */
  calculateHP(level, className, conModifier = 0) {
    if (level < 1 || level > 20) {
      console.warn(`LevelScaler | Invalid level: ${level}`);
      return 0;
    }

    const hitDie = this.classHitDice[className?.toLowerCase()] || 8;
    const hitDieAverage = Math.ceil(hitDie / 2) + 1;

    // First level: max hit die + CON mod (minimum 1)
    let hp = Math.max(1, hitDie + conModifier);

    // Subsequent levels: average hit die + CON mod (minimum 1 per level)
    for (let i = 2; i <= level; i++) {
      hp += Math.max(1, hitDieAverage + conModifier);
    }

    return hp;
  }

  /**
   * Calculate proficiency bonus based on level
   */
  calculateProficiency(level) {
    if (level < 1) return 0;
    if (level < 5) return 2;
    if (level < 9) return 3;
    if (level < 13) return 4;
    if (level < 17) return 5;
    return 6;
  }

  /**
   * Get ASI (Ability Score Improvement) opportunities up to current level
   * Returns array of levels where ASI is available
   */
  getASILevels(level) {
    return this.asiLevels.filter(asiLevel => asiLevel <= level);
  }

  /**
   * Check if current level grants an ASI
   */
  hasASIAtLevel(level) {
    return this.asiLevels.includes(level);
  }

  /**
   * Calculate spell slots for a given level
   * Returns array where index is spell level (0-8) and value is number of slots
   */
  calculateSpellSlots(level, className) {
    const progression = this.classSpellProgression[className?.toLowerCase()];

    // Non-caster classes
    if (!progression) {
      return [0, 0, 0, 0, 0, 0, 0, 0, 0];
    }

    // Warlocks don't use standard spell slots
    if (progression === 'warlock') {
      return this._calculateWarlockSlots(level);
    }

    const slotProgression = this.spellSlotProgression[progression];
    if (!slotProgression[level]) {
      return [0, 0, 0, 0, 0, 0, 0, 0, 0];
    }

    const slots = slotProgression[level];
    const spellSlots = [0, 0, 0, 0, 0, 0, 0, 0, 0];

    for (let i = 0; i < slots.length; i++) {
      spellSlots[i + 1] = slots[i];
    }

    return spellSlots;
  }

  /**
   * Calculate Warlock spell slots (special case)
   * Warlocks use Pact Magic with limited slots that recharge on short rest
   */
  _calculateWarlockSlots(level) {
    const warlockSlots = [0, 0, 0, 0, 0, 0, 0, 0, 0];

    if (level < 1) return warlockSlots;

    // Warlocks have 1 slot at level 1-4, 2 slots at 5-8, etc.
    const numSlots = Math.ceil(level / 5);
    const slotLevel = Math.min(5, Math.ceil(level / 5)); // Slot level increases at 5, 11, 17

    if (level >= 17) {
      warlockSlots[5] = 4;
    } else if (level >= 11) {
      warlockSlots[4] = 4;
    } else if (level >= 5) {
      warlockSlots[3] = Math.min(2 + Math.floor((level - 5) / 2), 4);
    } else {
      warlockSlots[1] = 1;
    }

    return warlockSlots;
  }

  /**
   * Get all class features that unlock at a specific level
   * Returns object with feature names and descriptions
   */
  getClassFeaturesAtLevel(level, className) {
    const features = {
      1: {
        'barbarian': ['Rage', 'Unarmored Defense'],
        'bard': ['Spellcasting', 'Bardic Inspiration'],
        'cleric': ['Spellcasting', 'Channel Divinity'],
        'druid': ['Spellcasting', 'Wild Shape'],
        'fighter': ['Fighting Style', 'Second Wind'],
        'monk': ['Unarmored Defense', 'Martial Arts'],
        'paladin': ['Divine Sense', 'Lay on Hands'],
        'ranger': ['Favored Enemy', 'Natural Explorer'],
        'rogue': ['Expertise', 'Sneak Attack'],
        'sorcerer': ['Spellcasting', 'Sorcerous Origin'],
        'warlock': ['Otherworldly Patron', 'Pact Magic'],
        'wizard': ['Spellcasting', 'Arcane Recovery']
      },
      2: {
        'barbarian': ['Reckless Attack'],
        'bard': ['Jack of All Trades'],
        'fighter': ['Action Surge'],
        'monk': ['Unarmored Movement'],
        'paladin': ['Fighting Style'],
        'warlock': ['Eldritch Invocations']
      },
      3: {
        'barbarian': ['Primal Path'],
        'bard': ['Bard College'],
        'cleric': ['Channel Divinity'],
        'druid': ['Circle of the Moon'],
        'fighter': ['Martial Archetype'],
        'monk': ['Monastic Tradition'],
        'paladin': ['Sacred Oath'],
        'ranger': ['Ranger Archetype'],
        'rogue': ['Roguish Archetype'],
        'sorcerer': ['Metamagic'],
        'warlock': ['Pact Boon'],
        'wizard': ['Arcane Tradition']
      },
      4: {
        'all': ['Ability Score Improvement']
      },
      5: {
        'bard': ['Expertise improvement'],
        'fighter': ['Extra Attack'],
        'monk': ['Extra Attack'],
        'paladin': ['Extra Attack'],
        'ranger': ['Extra Attack'],
        'warlock': ['Ability Score Improvement']
      },
      8: {
        'all': ['Ability Score Improvement']
      },
      11: {
        'bard': ['Magical Secrets'],
        'rogue': ['Reliable Talent'],
        'warlock': ['Mystic Arcanum (6th level)']
      },
      12: {
        'all': ['Ability Score Improvement']
      },
      16: {
        'all': ['Ability Score Improvement']
      },
      19: {
        'all': ['Ability Score Improvement']
      },
      20: {
        'barbarian': ['Primal Champion'],
        'bard': ['Superior Inspiration'],
        'cleric': ['Divine Intervention'],
        'druid': ['Unlimited Wild Shape'],
        'fighter': ['Extra Attack (Extra)'],
        'monk': ['Perfect Self'],
        'paladin': ['Holy Nimbus'],
        'ranger': ['Feral Senses'],
        'rogue': ['Stroke of Luck'],
        'sorcerer': ['Sorcerous Restoration'],
        'warlock': ['Eldritch Mastery'],
        'wizard': ['Spell Mastery']
      }
    };

    const levelFeatures = features[level] || {};
    const normalizedClassName = className?.toLowerCase() || '';

    return {
      classFeatures: levelFeatures[normalizedClassName] || [],
      universalFeatures: levelFeatures['all'] || [],
      level: level,
      className: className
    };
  }

  /**
   * Get summary of stats for a given level
   * Returns object with HP, proficiency, spell slots, ASI count
   */
  getSummary(level, className, conModifier = 0) {
    return {
      level: level,
      className: className,
      hp: this.calculateHP(level, className, conModifier),
      proficiency: this.calculateProficiency(level),
      spellSlots: this.calculateSpellSlots(level, className),
      totalASI: this.getASILevels(level).length,
      nextASI: this.asiLevels.find(asi => asi > level) || null,
      features: this.getClassFeaturesAtLevel(level, className)
    };
  }

  /**
   * Generate level progression table for reference
   * Shows HP, proficiency, and ASI milestones across all levels
   */
  generateProgressionTable(className, conModifier = 0) {
    const table = [];

    for (let level = 1; level <= 20; level++) {
      table.push({
        level: level,
        hp: this.calculateHP(level, className, conModifier),
        proficiency: this.calculateProficiency(level),
        asiAvailable: this.hasASIAtLevel(level),
        classFeatures: this.getClassFeaturesAtLevel(level, className).classFeatures
      });
    }

    return table;
  }

  /**
   * Get recommended ability score at starting level
   * Takes into account how they'll scale with future ASI
   */
  getRecommendedStartingScore(level, isPrimary = false) {
    const asiCount = this.getASILevels(level).length;

    if (isPrimary) {
      // Primary stats should be high to start, slight increase per ASI
      const baseScore = level === 1 ? 16 : 17;
      return Math.min(20, baseScore + Math.floor(asiCount / 2));
    } else {
      // Secondary stats can be moderate
      const baseScore = level === 1 ? 14 : 15;
      return Math.min(20, baseScore + Math.floor(asiCount / 3));
    }
  }

  /**
   * Calculate expected ability modifier at a given level
   * Takes into account future ASI improvements
   */
  getExpectedModifier(startingScore, level, improvementType = 'standard') {
    const asiCount = this.getASILevels(level).length;
    let improvements = 0;

    // Standard: +2 ability per ASI
    if (improvementType === 'standard') {
      improvements = asiCount * 2;
    }
    // Focused: All ASI into one ability
    else if (improvementType === 'focused') {
      improvements = asiCount * 2;
    }
    // Distributed: Spread ASI across multiple abilities
    else if (improvementType === 'distributed') {
      improvements = asiCount;
    }

    const finalScore = Math.min(20, startingScore + improvements);
    return Math.floor((finalScore - 10) / 2);
  }
}

// Export for use in axyum.mjs and node tests
export { LevelScaler };
export default LevelScaler;
if (typeof module !== 'undefined' && module.exports) {
  module.exports = LevelScaler;
}
