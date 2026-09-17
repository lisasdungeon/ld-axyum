/**
 * CharacterModel - Data validation and serialization for D&D 5e characters
 * Handles character data structure, validation, and normalization
 */

import { CHARACTER_DEFAULTS } from './character-defaults.js';
import { AbilityScoreUtils } from './ability-score-utils.js';
import { MulticlassUtils } from './multiclass-utils.js';

export class CharacterModel {
  /**
   * Default character data structure (delegated to character-defaults.js)
   * Supports both single-class (Phase 2) and multi-class (Phase 3a) characters
   */
  static getDefaults() {
    return JSON.parse(JSON.stringify(CHARACTER_DEFAULTS));
  }

  /**
   * Validate character data against schema
   * @param {Object} characterData - Character data to validate
   * @returns {Object} { valid: boolean, errors: string[] }
   */
  static validate(characterData) {
    const errors = [];

    // Required fields
    if (!characterData.name || characterData.name.trim() === '') {
      errors.push('Character name is required');
    }

    if (!characterData.class.id) {
      errors.push('Character class is required');
    }

    if (!characterData.race.id) {
      errors.push('Character race is required');
    }

    if (!characterData.background.id) {
      errors.push('Character background is required');
    }

    // Validate ability scores (must be 3-20)
    const abilityKeys = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
    for (const key of abilityKeys) {
      const score = characterData.abilities[key];
      if (!Number.isInteger(score) || score < 3 || score > 20) {
        errors.push(`${key.toUpperCase()} ability score must be between 3 and 20`);
      }
    }

    // Validate level (1-20)
    let level = characterData.class.level;
    if (characterData.isMulticlass && characterData.classes?.length > 0) {
      level = characterData.classes.reduce((sum, c) => sum + (c.level || 0), 0);
    }

    if (!Number.isInteger(level) || level < 1 || level > 20) {
      errors.push('Character level must be between 1 and 20');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Normalize character data for storage/transmission
   * @param {Object} characterData - Raw character data
   * @returns {Object} Normalized character data
   */
  static normalize(characterData) {
    if (!characterData) {
      return this.getDefaults();
    }

    // Migrate from Phase 2 to Phase 3a format if needed
    let data = this.migrateToMulticlass(characterData);

    const defaults = this.getDefaults();
    const normalized = {
      ...defaults,
      ...data
    };

    // Ensure nested objects are properly structured
    normalized.class = { ...defaults.class, ...(data?.class || {}) };
    normalized.race = { ...defaults.race, ...(data?.race || {}) };
    normalized.background = { ...defaults.background, ...(data?.background || {}) };
    normalized.abilities = { ...defaults.abilities, ...(data?.abilities || {}) };
    normalized.selectedEquipmentIds = Array.isArray(data?.selectedEquipmentIds)
      ? data.selectedEquipmentIds
      : [];
    normalized.selectedEquipmentItems = Array.isArray(data?.selectedEquipmentItems)
      ? data.selectedEquipmentItems
      : [];
    normalized.selectedCantrips = Array.isArray(data?.selectedCantrips)
      ? data.selectedCantrips
      : [];
    normalized.selectedSpells = Array.isArray(data?.selectedSpells)
      ? data.selectedSpells
      : [];
    normalized.details = { ...defaults.details, ...(data?.details || {}) };
    
    // Classes array is guaranteed by migrateToMulticlass
    normalized.classes = data.classes;

    // Ensure feats array exists (Phase 3b)
    normalized.feats = Array.isArray(data?.feats) ? data.feats : [];

    // Ensure ability scores are integers and within valid range
    for (const key of ['str', 'dex', 'con', 'int', 'wis', 'cha']) {
      let score = normalized.abilities[key];
      
      // Parse string input (from FormData)
      if (typeof score === 'string') {
        score = parseInt(score, 10);
      }

      if (typeof score !== 'number' || isNaN(score)) {
        normalized.abilities[key] = 10;
      } else {
        normalized.abilities[key] = Math.max(3, Math.min(20, Math.floor(score)));
      }
    }

    // Ensure multiclass levels are valid
    normalized.classes = normalized.classes.map(cls => {
      let lvl = cls.level;
      if (typeof lvl === 'string') lvl = parseInt(lvl, 10);
      
      return {
        ...cls,
        level: Math.max(1, Math.min(20, Math.floor(lvl || 1)))
      };
    });

    // Validate total level doesn't exceed 20
    const totalLevel = this.getTotalLevel(normalized);
    if (totalLevel > 20) {
      console.warn('CharacterModel | Total level exceeds 20, clamping last class', { totalLevel });
      const lastIdx = normalized.classes.length - 1;
      const overage = totalLevel - 20;
      normalized.classes[lastIdx].level = Math.max(1, normalized.classes[lastIdx].level - overage);
    }

    // Ensure totalLevel is always synced with class levels
    normalized.totalLevel = this.getTotalLevel(normalized);

    return normalized;
  }

  /**
   * Clone character data deeply
   * @param {Object} characterData - Character data to clone
   * @returns {Object} Deep clone of character data
   */
  static clone(characterData) {
    try {
      return JSON.parse(JSON.stringify(characterData || this.getDefaults()));
    } catch (err) {
      console.warn('CharacterModel | Clone error, returning defaults', err);
      return this.getDefaults();
    }
  }

  /**
   * Check if two character data objects are equal
   * @param {Object} data1 - First character data
   * @param {Object} data2 - Second character data
   * @returns {boolean} True if equal
   */
  static equals(data1, data2) {
    if (!data1 || !data2) return false;
    try {
      return JSON.stringify(data1) === JSON.stringify(data2);
    } catch (err) {
      return false;
    }
  }

  /**
   * Get ability score modifier from ability score (delegated to ability-score-utils.js)
   * @param {number} abilityScore - Ability score (3-20)
   * @returns {number} Ability modifier
   */
  static getAbilityModifier(abilityScore) {
    return AbilityScoreUtils.getAbilityModifier(abilityScore);
  }

  /**
   * Get all ability modifiers for a character (delegated to ability-score-utils.js)
   * @param {Object} abilities - Character abilities object
   * @returns {Object} Object with modifier for each ability
   */
  static getAbilityModifiers(abilities) {
    return AbilityScoreUtils.getAbilityModifiers(abilities);
  }

  /**
   * Apply ability score method (delegated to ability-score-utils.js)
   * @param {string} method - 'standard', 'pointbuy', or 'roll'
   * @returns {Object} Ability scores object
   */
  static generateAbilityScores(method = 'standard') {
    return AbilityScoreUtils.generateAbilityScores(method);
  }

  /**
   * Serialize character data to JSON
   * @param {Object} characterData - Character data to serialize
   * @returns {string} JSON string
   */
  static serialize(characterData) {
    return JSON.stringify(characterData, null, 2);
  }

  /**
   * Deserialize character data from JSON
   * @param {string} jsonString - JSON string to deserialize
   * @returns {Object} Deserialized character data
   */
  static deserialize(jsonString) {
    try {
      return JSON.parse(jsonString);
    } catch (e) {
      console.error('Failed to deserialize character data', e);
      return this.getDefaults();
    }
  }

  /**
   * Validate multiclass character data (delegated to multiclass-utils.js)
   * @param {Object} characterData - Character with classes array
   * @returns {Object} { valid: boolean, errors: string[] }
   */
  static validateMulticlass(characterData) {
    return MulticlassUtils.validateMulticlass(characterData);
  }

  /**
   * Migrate Phase 2 single-class character to Phase 3 multiclass format (delegated to multiclass-utils.js)
   * Automatically called during normalization for backward compatibility
   * @param {Object} characterData - Phase 2 character data
   * @returns {Object} Updated character data with multiclass support
   */
  static migrateToMulticlass(characterData) {
    return MulticlassUtils.migrateToMulticlass(characterData);
  }

  /**
   * Get total character level across all classes (delegated to multiclass-utils.js)
   * @param {Object} characterData - Character data
   * @returns {number} Total level
   */
  static getTotalLevel(characterData) {
    return MulticlassUtils.getTotalLevel(characterData);
  }

  /**
   * Get primary class (first class in array) (delegated to multiclass-utils.js)
   * @param {Object} characterData - Character data
   * @returns {Object} Primary class object or null
   */
  static getPrimaryClass(characterData) {
    return MulticlassUtils.getPrimaryClass(characterData);
  }
}

