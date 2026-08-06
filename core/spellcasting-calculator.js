/**
 * Spellcasting Calculator
 * D&D 5e spell slots, cantrips, and spellcasting mechanics
 */

export class SpellcastingCalculator {
  /**
   * Get spell slots for a class at a given level
   * Returns null if not a spellcaster
   * 
   * @param {string} className - Class name
   * @param {number} level - Character level
   * @returns {Object|null} Object with slot counts by level, or null if not spellcaster
   */
  static getSpellSlots(className, level) {
    const slots = {
      full: {
        1: [2, 0, 0, 0, 0, 0, 0, 0, 0],
        2: [3, 0, 0, 0, 0, 0, 0, 0, 0],
        3: [4, 2, 0, 0, 0, 0, 0, 0, 0],
        4: [4, 3, 0, 0, 0, 0, 0, 0, 0],
        5: [4, 3, 2, 0, 0, 0, 0, 0, 0],
        6: [4, 3, 3, 0, 0, 0, 0, 0, 0],
        7: [4, 3, 3, 1, 0, 0, 0, 0, 0],
        8: [4, 3, 3, 2, 0, 0, 0, 0, 0],
        9: [4, 3, 3, 3, 1, 0, 0, 0, 0],
        10: [4, 3, 3, 3, 2, 0, 0, 0, 0],
        11: [4, 3, 3, 3, 2, 1, 0, 0, 0],
        12: [4, 3, 3, 3, 2, 1, 0, 0, 0],
        13: [4, 3, 3, 3, 2, 1, 1, 0, 0],
        14: [4, 3, 3, 3, 2, 1, 1, 0, 0],
        15: [4, 3, 3, 3, 2, 1, 1, 1, 0],
        16: [4, 3, 3, 3, 2, 1, 1, 1, 0],
        17: [4, 3, 3, 3, 2, 1, 1, 1, 1],
        18: [4, 3, 3, 3, 3, 1, 1, 1, 1],
        19: [4, 3, 3, 3, 3, 2, 1, 1, 1],
        20: [4, 3, 3, 3, 3, 2, 2, 1, 1]
      },
      half: {
        1: [0, 0, 0, 0, 0, 0, 0, 0, 0],
        2: [2, 0, 0, 0, 0, 0, 0, 0, 0],
        3: [3, 0, 0, 0, 0, 0, 0, 0, 0],
        4: [3, 0, 0, 0, 0, 0, 0, 0, 0],
        5: [4, 2, 0, 0, 0, 0, 0, 0, 0],
        6: [4, 2, 0, 0, 0, 0, 0, 0, 0],
        7: [4, 3, 0, 0, 0, 0, 0, 0, 0],
        8: [4, 3, 0, 0, 0, 0, 0, 0, 0],
        9: [4, 3, 2, 0, 0, 0, 0, 0, 0],
        10: [4, 3, 2, 0, 0, 0, 0, 0, 0],
        11: [4, 3, 3, 0, 0, 0, 0, 0, 0],
        12: [4, 3, 3, 0, 0, 0, 0, 0, 0],
        13: [4, 3, 3, 1, 0, 0, 0, 0, 0],
        14: [4, 3, 3, 1, 0, 0, 0, 0, 0],
        15: [4, 3, 3, 2, 0, 0, 0, 0, 0],
        16: [4, 3, 3, 2, 0, 0, 0, 0, 0],
        17: [4, 3, 3, 3, 1, 0, 0, 0, 0],
        18: [4, 3, 3, 3, 1, 0, 0, 0, 0],
        19: [4, 3, 3, 3, 2, 0, 0, 0, 0],
        20: [4, 3, 3, 3, 2, 0, 0, 0, 0]
      }
    };

    // Handle null/undefined className
    if (!className) return null;
    const classType = String(className).toLowerCase();
    
    // Full casters: Cleric, Druid, Wizard, Bard, Sorcerer
    const fullCasters = ['cleric', 'druid', 'wizard', 'bard', 'sorcerer'];
    if (fullCasters.includes(classType)) {
      return {
        type: 'full',
        slots: slots.full[level] || slots.full[20]
      };
    }

    // Half casters: Paladin, Ranger
    const halfCasters = ['paladin', 'ranger'];
    if (halfCasters.includes(classType)) {
      return {
        type: 'half',
        slots: slots.half[level] || slots.half[20]
      };
    }

    // Warlocks and others: not tracked here
    return null;
  }

  /**
   * Check if a class is a spellcaster
   * @param {string} className - Class name
   * @returns {boolean} True if class can cast spells
   */
  static isSpellcaster(className) {
    if (!className) return false;
    const spellcasters = [
      'artificer',
      'bard',
      'cleric',
      'druid',
      'paladin',
      'ranger',
      'sorcerer',
      'warlock',
      'wizard'
    ];
    return spellcasters.includes(String(className).toLowerCase());
  }

  /**
   * Get number of cantrips known for a class
   * @param {string} className - Class name
   * @param {number} level - Character level
   * @returns {number} Number of cantrips
   */
  static getCantripCount(className, level) {
    const cantripProgression = {
      'bard': { 1: 2, 4: 3, 10: 4 },
      'cleric': { 1: 3, 4: 4, 10: 5 },
      'druid': { 1: 2, 4: 3, 10: 4 },
      'sorcerer': { 1: 4, 4: 5, 10: 6 },
      'wizard': { 1: 3, 4: 4, 10: 5 },
      'warlock': { 1: 2, 4: 3, 10: 4 },
      'artificer': { 1: 2, 10: 3, 14: 4 }
    };

    // Handle null/undefined className
    if (!className) return 0;
    const classProgression = cantripProgression[String(className).toLowerCase()];
    if (!classProgression) return 0;

    let count = 0;
    for (const [lvl, cnt] of Object.entries(classProgression)) {
      if (level >= parseInt(lvl)) {
        count = cnt;
      }
    }

    return count;
  }
}

export default SpellcastingCalculator;
