/**
 * Pf2eSpellcastingCalculator - Spell slot progression and spell DC/attack math.
 *
 * NOTE: PF2e unifies prepared and spontaneous casters onto the same slots-per-rank
 * table (unlike dnd5e's separate full/half caster tables) — spontaneous casters
 * simply don't need to prepare into their slots ahead of time. This table reflects
 * the standard full-caster (Wizard/Cleric/Druid/Bard/Sorcerer) progression and should
 * be verified against the live pf2e class items during wizard implementation, since
 * some classes vary slightly.
 */
import { Pf2eProficiencyCalculator } from './pf2e-proficiency-calculator.js';

// Index 0 = rank 1 slots, index 9 = rank 10 slots, at each character level 1-20
const FULL_CASTER_SLOTS = {
  1: [2, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  2: [3, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  3: [3, 2, 0, 0, 0, 0, 0, 0, 0, 0],
  4: [3, 3, 0, 0, 0, 0, 0, 0, 0, 0],
  5: [3, 3, 2, 0, 0, 0, 0, 0, 0, 0],
  6: [3, 3, 3, 0, 0, 0, 0, 0, 0, 0],
  7: [3, 3, 3, 2, 0, 0, 0, 0, 0, 0],
  8: [3, 3, 3, 3, 0, 0, 0, 0, 0, 0],
  9: [3, 3, 3, 3, 2, 0, 0, 0, 0, 0],
  10: [3, 3, 3, 3, 3, 0, 0, 0, 0, 0],
  11: [3, 3, 3, 3, 3, 2, 0, 0, 0, 0],
  12: [3, 3, 3, 3, 3, 3, 0, 0, 0, 0],
  13: [3, 3, 3, 3, 3, 3, 2, 0, 0, 0],
  14: [3, 3, 3, 3, 3, 3, 3, 0, 0, 0],
  15: [3, 3, 3, 3, 3, 3, 3, 2, 0, 0],
  16: [3, 3, 3, 3, 3, 3, 3, 3, 0, 0],
  17: [3, 3, 3, 3, 3, 3, 3, 3, 2, 0],
  18: [3, 3, 3, 3, 3, 3, 3, 3, 3, 0],
  19: [3, 3, 3, 3, 3, 3, 3, 3, 3, 1],
  20: [3, 3, 3, 3, 3, 3, 3, 3, 3, 1]
};

const BASE_CANTRIPS_KNOWN = 5;

export class Pf2eSpellcastingCalculator {
  /**
   * Get spell slots by rank (1-10) for a full caster at a given level.
   * @param {number} level
   * @returns {number[]} 10-element array, index 0 = rank 1
   */
  static getSpellSlots(level) {
    const lvl = Math.max(1, Math.min(20, Math.floor(Number(level) || 1)));
    return [...(FULL_CASTER_SLOTS[lvl] || FULL_CASTER_SLOTS[1])];
  }

  /**
   * Get the number of cantrips known at a given level.
   * @param {number} level
   * @returns {number}
   */
  static getCantripsKnown(level) {
    const lvl = Math.max(1, Math.min(20, Math.floor(Number(level) || 1)));
    // Cantrips gain an additional known slot roughly every 4 levels; approximate,
    // refine per-class once wired against real class item data.
    return BASE_CANTRIPS_KNOWN + Math.floor(lvl / 4);
  }

  /**
   * Calculate spell DC.
   * @param {Object} options
   * @param {number} options.abilityModifier
   * @param {string|number} options.rank
   * @param {number} options.level
   * @param {boolean} [options.proficiencyWithoutLevel=false]
   * @returns {number}
   */
  static calculateSpellDC(options) {
    const { abilityModifier = 0, rank = 'trained', level = 1, proficiencyWithoutLevel = false } = options || {};
    return 10 + abilityModifier + Pf2eProficiencyCalculator.getProficiencyBonus(rank, level, { proficiencyWithoutLevel });
  }

  /**
   * Calculate spell attack bonus.
   * @param {Object} options
   * @param {number} options.abilityModifier
   * @param {string|number} options.rank
   * @param {number} options.level
   * @param {boolean} [options.proficiencyWithoutLevel=false]
   * @returns {number}
   */
  static calculateSpellAttack(options) {
    const { abilityModifier = 0, rank = 'trained', level = 1, proficiencyWithoutLevel = false } = options || {};
    return abilityModifier + Pf2eProficiencyCalculator.getProficiencyBonus(rank, level, { proficiencyWithoutLevel });
  }

  /**
   * Highest spell rank a caster has slots for at a given level.
   * @param {number} level
   * @returns {number} 0 if no slots yet, else 1-10
   */
  static getMaxSpellRank(level) {
    const slots = this.getSpellSlots(level);
    let max = 0;
    slots.forEach((count, idx) => { if (count > 0) max = idx + 1; });
    return max;
  }
}
