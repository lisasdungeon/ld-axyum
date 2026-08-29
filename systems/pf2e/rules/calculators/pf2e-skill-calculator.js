/**
 * Pf2eSkillCalculator - Skill bonus and trained-skill budget math for PF2e.
 */
import { Pf2eProficiencyCalculator } from './pf2e-proficiency-calculator.js';

export const PF2E_SKILLS = {
  acrobatics: 'dex',
  arcana: 'int',
  athletics: 'str',
  crafting: 'int',
  deception: 'cha',
  diplomacy: 'cha',
  intimidation: 'cha',
  medicine: 'wis',
  nature: 'wis',
  occultism: 'int',
  performance: 'cha',
  religion: 'wis',
  society: 'int',
  stealth: 'dex',
  survival: 'wis',
  thievery: 'dex'
};

export class Pf2eSkillCalculator {
  /**
   * Calculate a skill's total bonus.
   * @param {Object} options
   * @param {number} options.abilityModifier
   * @param {string|number} options.rank
   * @param {number} options.level
   * @param {boolean} [options.proficiencyWithoutLevel=false]
   * @param {number} [options.armorPenalty=0] - Armor check penalty, for Str-based/armor-affected skills
   * @returns {number}
   */
  static calculateSkillBonus(options) {
    const {
      abilityModifier = 0,
      rank = 'untrained',
      level = 1,
      proficiencyWithoutLevel = false,
      armorPenalty = 0
    } = options || {};
    return abilityModifier
      + Pf2eProficiencyCalculator.getProficiencyBonus(rank, level, { proficiencyWithoutLevel })
      - armorPenalty;
  }

  /**
   * Get the number of skills a character can train at level 1: the class's
   * base budget plus one extra per point of positive Intelligence modifier.
   * @param {number} intModifier
   * @param {number} classSkillBudget
   * @returns {number}
   */
  static getTrainedSkillBudget(intModifier, classSkillBudget) {
    return Math.max(0, Number(classSkillBudget) || 0) + Math.max(0, Number(intModifier) || 0);
  }

  /**
   * List of the 16 core PF2e skill slugs (lore skills are separate, item-backed).
   * @returns {string[]}
   */
  static getCoreSkillSlugs() {
    return Object.keys(PF2E_SKILLS);
  }

  /**
   * Get the governing ability for a core skill.
   * @param {string} slug
   * @returns {string|null}
   */
  static getSkillAbility(slug) {
    return PF2E_SKILLS[slug] || null;
  }
}
