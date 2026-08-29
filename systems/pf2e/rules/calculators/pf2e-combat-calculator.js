/**
 * Pf2eCombatCalculator - HP, AC, saves, perception, and class DC math for PF2e.
 */
import { Pf2eProficiencyCalculator } from './pf2e-proficiency-calculator.js';

export class Pf2eCombatCalculator {
  /**
   * Calculate max hit points.
   * @param {Object} options
   * @param {number} options.ancestryHP - Ancestry base HP
   * @param {number} options.classHPPerLevel - Class HP granted per level
   * @param {number} options.level - Character level
   * @param {number} options.conModifier - Constitution modifier
   * @returns {number}
   */
  static calculateHP(options) {
    const { ancestryHP = 0, classHPPerLevel = 0, level = 1, conModifier = 0 } = options || {};
    return ancestryHP + (classHPPerLevel + conModifier) * Math.max(1, level);
  }

  /**
   * Calculate armor class.
   * @param {Object} options
   * @param {number} options.dexModifier
   * @param {string|number} options.armorRank - Proficiency rank in the worn armor's category
   * @param {number} [options.dexCap] - Armor's dex cap, if any (Infinity/undefined = unarmored/no cap)
   * @param {number} [options.itemBonus=0] - Armor's own item AC bonus
   * @param {number} level
   * @param {boolean} [options.proficiencyWithoutLevel=false]
   * @returns {number}
   */
  static calculateAC(options) {
    const {
      dexModifier = 0,
      armorRank = 'trained',
      dexCap,
      itemBonus = 0,
      level = 1,
      proficiencyWithoutLevel = false
    } = options || {};

    const cappedDex = Number.isFinite(dexCap) ? Math.min(dexModifier, dexCap) : dexModifier;
    const profBonus = Pf2eProficiencyCalculator.getProficiencyBonus(armorRank, level, { proficiencyWithoutLevel });
    return 10 + cappedDex + profBonus + itemBonus;
  }

  /**
   * Calculate a saving throw bonus.
   * @param {Object} options
   * @param {number} options.abilityModifier
   * @param {string|number} options.rank
   * @param {number} options.level
   * @param {boolean} [options.proficiencyWithoutLevel=false]
   * @returns {number}
   */
  static calculateSave(options) {
    const { abilityModifier = 0, rank = 'untrained', level = 1, proficiencyWithoutLevel = false } = options || {};
    return abilityModifier + Pf2eProficiencyCalculator.getProficiencyBonus(rank, level, { proficiencyWithoutLevel });
  }

  /**
   * Calculate perception bonus (governed by Wisdom).
   * @param {Object} options
   * @param {number} options.wisModifier
   * @param {string|number} options.rank
   * @param {number} options.level
   * @param {boolean} [options.proficiencyWithoutLevel=false]
   * @returns {number}
   */
  static calculatePerception(options) {
    const { wisModifier = 0, rank = 'untrained', level = 1, proficiencyWithoutLevel = false } = options || {};
    return wisModifier + Pf2eProficiencyCalculator.getProficiencyBonus(rank, level, { proficiencyWithoutLevel });
  }

  /**
   * Calculate class DC.
   * @param {Object} options
   * @param {number} options.keyAbilityModifier
   * @param {string|number} options.rank
   * @param {number} options.level
   * @param {boolean} [options.proficiencyWithoutLevel=false]
   * @returns {number}
   */
  static calculateClassDC(options) {
    const { keyAbilityModifier = 0, rank = 'trained', level = 1, proficiencyWithoutLevel = false } = options || {};
    return 10 + keyAbilityModifier + Pf2eProficiencyCalculator.getProficiencyBonus(rank, level, { proficiencyWithoutLevel });
  }
}
