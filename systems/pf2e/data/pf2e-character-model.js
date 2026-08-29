/**
 * Pf2eCharacterModel - Data validation and normalization for PF2e characters.
 * Deliberately independent of core/character-model.js (dnd5e's shape).
 */
import { PF2E_CHARACTER_DEFAULTS } from './pf2e-character-defaults.js';
import { Pf2eAbilityBoostCalculator } from '../rules/calculators/pf2e-ability-boost-calculator.js';

export class Pf2eCharacterModel {
  static getDefaults() {
    return JSON.parse(JSON.stringify(PF2E_CHARACTER_DEFAULTS));
  }

  /**
   * Validate character data against pf2e requirements.
   * @param {Object} characterData
   * @returns {{valid: boolean, errors: string[]}}
   */
  static validate(characterData) {
    const errors = [];

    if (!characterData?.name || characterData.name.trim() === '') {
      errors.push('Character name is required');
    }
    if (!characterData?.ancestry?.id) {
      errors.push('Character ancestry is required');
    }
    if (!characterData?.background?.id) {
      errors.push('Character background is required');
    }
    if (!characterData?.class?.id) {
      errors.push('Character class is required');
    }

    const freeBoosts = characterData?.abilityBoosts?.free || [];
    const resolvedFreeBoosts = freeBoosts.filter(Boolean);
    if (resolvedFreeBoosts.length < 4) {
      errors.push('All 4 free ability boosts must be assigned');
    }
    const boostValidation = Pf2eAbilityBoostCalculator.validateFreeBoosts(resolvedFreeBoosts);
    if (!boostValidation.valid) {
      errors.push(...boostValidation.errors);
    }

    const level = Number(characterData?.level) || 0;
    if (!Number.isInteger(level) || level < 1 || level > 20) {
      errors.push('Character level must be between 1 and 20');
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Normalize character data for storage/transmission, merging with defaults.
   * @param {Object} characterData
   * @returns {Object}
   */
  static normalize(characterData) {
    if (!characterData) return this.getDefaults();

    const defaults = this.getDefaults();
    const normalized = { ...defaults, ...characterData };

    normalized.ancestry = { ...defaults.ancestry, ...(characterData.ancestry || {}) };
    normalized.heritage = { ...defaults.heritage, ...(characterData.heritage || {}) };
    normalized.background = { ...defaults.background, ...(characterData.background || {}) };
    normalized.class = { ...defaults.class, ...(characterData.class || {}) };
    normalized.abilityBoosts = {
      ...defaults.abilityBoosts,
      ...(characterData.abilityBoosts || {}),
      free: Array.isArray(characterData.abilityBoosts?.free)
        ? characterData.abilityBoosts.free.slice(0, 4)
        : [...defaults.abilityBoosts.free]
    };
    normalized.abilities = { ...defaults.abilities, ...(characterData.abilities || {}) };
    normalized.proficiencies = {
      ...defaults.proficiencies,
      ...(characterData.proficiencies || {}),
      saves: { ...defaults.proficiencies.saves, ...(characterData.proficiencies?.saves || {}) },
      skills: { ...(characterData.proficiencies?.skills || {}) },
      weapons: { ...(characterData.proficiencies?.weapons || {}) },
      armor: { ...(characterData.proficiencies?.armor || {}) }
    };
    normalized.feats = {
      ancestry: Array.isArray(characterData.feats?.ancestry) ? characterData.feats.ancestry : [],
      class: Array.isArray(characterData.feats?.class) ? characterData.feats.class : [],
      skill: Array.isArray(characterData.feats?.skill) ? characterData.feats.skill : [],
      general: Array.isArray(characterData.feats?.general) ? characterData.feats.general : [],
      bonus: Array.isArray(characterData.feats?.bonus) ? characterData.feats.bonus : []
    };
    normalized.languages = Array.isArray(characterData.languages) ? characterData.languages : [];
    normalized.equipment = {
      selectedIds: Array.isArray(characterData.equipment?.selectedIds) ? characterData.equipment.selectedIds : [],
      currency: { ...defaults.equipment.currency, ...(characterData.equipment?.currency || {}) }
    };
    normalized.spells = {
      selectedCantrips: Array.isArray(characterData.spells?.selectedCantrips) ? characterData.spells.selectedCantrips : [],
      selectedSpells: { ...(characterData.spells?.selectedSpells || {}) }
    };
    normalized.hitPoints = { ...defaults.hitPoints, ...(characterData.hitPoints || {}) };
    normalized.details = { ...defaults.details, ...(characterData.details || {}) };

    let level = normalized.level;
    if (typeof level === 'string') level = parseInt(level, 10);
    normalized.level = Number.isFinite(level) ? Math.max(1, Math.min(20, Math.floor(level))) : 1;

    return normalized;
  }

  /**
   * Clone character data deeply.
   * @param {Object} characterData
   * @returns {Object}
   */
  static clone(characterData) {
    try {
      return JSON.parse(JSON.stringify(characterData || this.getDefaults()));
    } catch (err) {
      console.warn('Pf2eCharacterModel | Clone error, returning defaults', err);
      return this.getDefaults();
    }
  }
}
