/**
 * Pf2eRulesEngine - PF2e calculations and mechanics.
 * Thin static facade over the pf2e calculators, mirroring core/rules-engine.js's
 * role for dnd5e so callers use one import.
 */
import { Pf2eProficiencyCalculator } from './calculators/pf2e-proficiency-calculator.js';
import { Pf2eAbilityBoostCalculator } from './calculators/pf2e-ability-boost-calculator.js';
import { Pf2eCombatCalculator } from './calculators/pf2e-combat-calculator.js';
import { Pf2eSkillCalculator } from './calculators/pf2e-skill-calculator.js';
import { Pf2eFeatCalculator } from './calculators/pf2e-feat-calculator.js';
import { Pf2eSpellcastingCalculator } from './calculators/pf2e-spellcasting-calculator.js';

export class Pf2eRulesEngine {
  // ===== Proficiency =====
  static getProficiencyBonus(rank, level, options) {
    return Pf2eProficiencyCalculator.getProficiencyBonus(rank, level, options);
  }

  static getRankLabel(rank) {
    return Pf2eProficiencyCalculator.getRankLabel(rank);
  }

  // ===== Ability boosts =====
  static computeFinalAbilities(options) {
    return Pf2eAbilityBoostCalculator.computeFinalAbilities(options);
  }

  static getAbilityModifiers(abilities) {
    return Pf2eAbilityBoostCalculator.getModifiers(abilities);
  }

  static getAbilityModifier(score) {
    return Pf2eAbilityBoostCalculator.getModifier(score);
  }

  static validateFreeBoosts(freeBoosts) {
    return Pf2eAbilityBoostCalculator.validateFreeBoosts(freeBoosts);
  }

  // ===== Combat =====
  static calculateHP(options) {
    return Pf2eCombatCalculator.calculateHP(options);
  }

  static calculateAC(options) {
    return Pf2eCombatCalculator.calculateAC(options);
  }

  static calculateSave(options) {
    return Pf2eCombatCalculator.calculateSave(options);
  }

  static calculatePerception(options) {
    return Pf2eCombatCalculator.calculatePerception(options);
  }

  static calculateClassDC(options) {
    return Pf2eCombatCalculator.calculateClassDC(options);
  }

  // ===== Skills =====
  static calculateSkillBonus(options) {
    return Pf2eSkillCalculator.calculateSkillBonus(options);
  }

  static getTrainedSkillBudget(intModifier, classSkillBudget) {
    return Pf2eSkillCalculator.getTrainedSkillBudget(intModifier, classSkillBudget);
  }

  static getCoreSkillSlugs() {
    return Pf2eSkillCalculator.getCoreSkillSlugs();
  }

  static getSkillAbility(slug) {
    return Pf2eSkillCalculator.getSkillAbility(slug);
  }

  // ===== Feats =====
  static getFeatSlotsAtLevel(level) {
    return Pf2eFeatCalculator.getFeatSlotsAtLevel(level);
  }

  static getFeatSlotsGrantedAtLevel(level) {
    return Pf2eFeatCalculator.getFeatSlotsGrantedAtLevel(level);
  }

  static validateFeatPrerequisites(feat, characterData) {
    return Pf2eFeatCalculator.validateFeatPrerequisites(feat, characterData);
  }

  // ===== Spellcasting =====
  static getSpellSlots(level) {
    return Pf2eSpellcastingCalculator.getSpellSlots(level);
  }

  static getCantripsKnown(level) {
    return Pf2eSpellcastingCalculator.getCantripsKnown(level);
  }

  static getMaxSpellRank(level) {
    return Pf2eSpellcastingCalculator.getMaxSpellRank(level);
  }

  static calculateSpellDC(options) {
    return Pf2eSpellcastingCalculator.calculateSpellDC(options);
  }

  static calculateSpellAttack(options) {
    return Pf2eSpellcastingCalculator.calculateSpellAttack(options);
  }
}
