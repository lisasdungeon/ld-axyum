/**
 * LD Axyum Spell Management System
 * Handles spell slot tracking, preparation, and recovery
 * Supports multiclass spell slot calculations per D&D 5e rules
 */

class SpellManagement {
  /**
   * Calculate spell slots for character based on classes and levels
   * Follows D&D 5e multiclass spell slot rules
   */
  static calculateSpellSlots(characterData) {
    const slots = {
      1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0
    };

    if (!characterData.classes || !characterData.classes.length) {
      return slots;
    }

    // Get spell slot proficiency levels per class
    let totalSpellLevelProgress = 0;

    characterData.classes.forEach(cls => {
      const classLevel = cls.level || 0;
      const casterType = this._getCasterType(cls.classId);

      // Calculate spell level progression (for multiclass slot calculation)
      switch (casterType) {
        case 'full': // Bard, Cleric, Druid, Sorcerer, Wizard
          totalSpellLevelProgress += classLevel;
          break;
        case 'half': // Artificer, Paladin, Ranger
          totalSpellLevelProgress += Math.floor(classLevel / 2);
          break;
        case 'third': // Eldritch Knight, Arcane Trickster
          totalSpellLevelProgress += Math.floor(classLevel / 3);
          break;
        case 'warlock': // Warlock (special pact slots)
          // Handled separately
          break;
        case 'none':
        default:
          // Non-caster class
          break;
      }
    });

    // Calculate slots per level
    if (totalSpellLevelProgress > 0) {
      const progressLevel = Math.min(totalSpellLevelProgress, 20); // Cap at 20
      const slotTable = this._getSpellSlotTable(progressLevel);
      Object.assign(slots, slotTable);
    }

    // Add warlock pact slots separately
    const warlockSlots = this._calculateWarlockSlots(characterData.classes);
    if (warlockSlots.slots > 0) {
      slots.warlock = {
        slots: warlockSlots.slots,
        level: warlockSlots.level,
        recovery: 'short' // Warlock slots recover on short rest
      };
    }

    return slots;
  }

  /**
   * Get caster type for class
   */
  static _getCasterType(classId) {
    const fullCasters = ['bard', 'cleric', 'druid', 'sorcerer', 'wizard'];
    const halfCasters = ['artificer', 'paladin', 'ranger'];
    const thirdCasters = ['fighter-eldritch-knight', 'rogue-arcane-trickster'];
    const warlocks = ['warlock'];

    if (fullCasters.includes(classId)) return 'full';
    if (halfCasters.includes(classId)) return 'half';
    if (thirdCasters.includes(classId)) return 'third';
    if (warlocks.includes(classId)) return 'warlock';
    return 'none';
  }

  /**
   * D&D 5e spell slot progression table
   * Based on multiclass spell slot table
   */
  static _getSpellSlotTable(casterLevel) {
    const table = {
      1: { 1: 2, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0 },
      2: { 1: 3, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0 },
      3: { 1: 4, 2: 2, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0 },
      4: { 1: 4, 2: 3, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0 },
      5: { 1: 4, 2: 3, 3: 2, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0 },
      6: { 1: 4, 2: 3, 3: 3, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0 },
      7: { 1: 4, 2: 3, 3: 3, 4: 1, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0 },
      8: { 1: 4, 2: 3, 3: 3, 4: 2, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0 },
      9: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 1, 6: 0, 7: 0, 8: 0, 9: 0 },
      10: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 0, 7: 0, 8: 0, 9: 0 },
      11: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 0, 8: 0, 9: 0 },
      12: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 0, 8: 0, 9: 0 },
      13: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1, 8: 0, 9: 0 },
      14: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1, 8: 0, 9: 0 },
      15: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1, 8: 1, 9: 0 },
      16: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1, 8: 1, 9: 0 },
      17: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1, 8: 1, 9: 1 },
      18: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 3, 6: 1, 7: 1, 8: 1, 9: 1 },
      19: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 3, 6: 2, 7: 1, 8: 1, 9: 1 },
      20: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 3, 6: 2, 7: 2, 8: 1, 9: 1 }
    };

    return table[Math.min(casterLevel, 20)] || table[1];
  }

  /**
   * Calculate warlock pact slots
   */
  static _calculateWarlockSlots(classes) {
    const warlockClass = classes.find(c => c.classId === 'warlock');
    if (!warlockClass) return { slots: 0, level: 0 };

    const warlockLevel = warlockClass.level || 0;
    
    let slots = 1;
    let slotLevel = 1;

    if (warlockLevel >= 2) slots = 2;
    if (warlockLevel >= 3) slots = 2;
    if (warlockLevel >= 5) { slots = 3; slotLevel = 2; }
    if (warlockLevel >= 7) { slots = 3; slotLevel = 2; }
    if (warlockLevel >= 9) { slots = 4; slotLevel = 3; }
    if (warlockLevel >= 11) { slots = 4; slotLevel = 3; }
    if (warlockLevel >= 13) { slots = 5; slotLevel = 4; }
    if (warlockLevel >= 15) { slots = 5; slotLevel = 4; }
    if (warlockLevel >= 17) { slots = 6; slotLevel = 5; }
    if (warlockLevel >= 19) { slots = 6; slotLevel = 5; }

    return { slots, level: slotLevel };
  }

  /**
   * Get spells available for preparation
   */
  static getAvailableSpellsForPreparation(actor, characterData) {
    const prepared = [];
    const available = [];

    if (!actor.items) return { prepared: [], available: [] };

    actor.items.forEach(item => {
      if (item.type !== 'spell') return;

      const spell = {
        id: item.id,
        name: item.name,
        level: item.system?.level || 0,
        source: item.system?.source || 'Custom'
      };

      if (item.system?.preparation?.prepared) {
        prepared.push(spell);
      } else {
        available.push(spell);
      }
    });

    return { prepared, available };
  }

  /**
   * Get spells prepared limit for class
   */
  static getPreparedSpellLimit(characterData) {
    const limits = {};

    if (!characterData.classes || !characterData.classes.length) {
      return limits;
    }

    characterData.classes.forEach(cls => {
      const classId = cls.classId;
      const level = cls.level || 1;

      switch (classId) {
        case 'cleric':
        case 'druid':
          // Prepared = WIS mod + class level
          limits[classId] = this._getAbilityModifier(characterData.abilities.wis) + level;
          break;
        case 'paladin':
          // Prepared = CHA mod + spell level (minimum 1 per spell level)
          limits[classId] = Math.max(1, this._getAbilityModifier(characterData.abilities.cha));
          break;
        case 'bard':
        case 'sorcerer':
        case 'wizard':
          // These classes don't have a preparation mechanic typically
          limits[classId] = null;
          break;
      }
    });

    return limits;
  }

  /**
   * Update spell slots after rest
   */
  static async updateSpellSlotsOnRest(actor, restType = 'long') {
    try {
      const slotFlags = actor.getFlag('ld-axyum', 'spellSlots') || {};

      if (restType === 'long') {
        // All spell slots recover on long rest
        Object.keys(slotFlags).forEach(level => {
          if (level === 'warlock') {
            slotFlags[level].current = slotFlags[level].slots;
          } else if (level !== 'cantrips') {
            slotFlags[level].current = slotFlags[level].max;
          }
        });
      } else if (restType === 'short') {
        // Only warlock slots recover on short rest
        if (slotFlags.warlock) {
          slotFlags.warlock.current = slotFlags.warlock.slots;
        }
      }

      await actor.setFlag('ld-axyum', 'spellSlots', slotFlags);
      return slotFlags;
    } catch (err) {
      console.error('LD Axyum | Failed to update spell slots on rest:', err);
      return null;
    }
  }

  /**
   * Get ability modifier
   */
  static _getAbilityModifier(abilityScore) {
    return Math.floor((abilityScore - 10) / 2);
  }

  /**
   * Initialize spell slots for actor
   */
  static async initializeSpellSlots(actor, characterData) {
    try {
      const slotTable = this.calculateSpellSlots(characterData);
      
      const slots = {};
      Object.entries(slotTable).forEach(([level, max]) => {
        if (level === 'warlock') {
          slots[level] = {
            slots: max.slots,
            level: max.level,
            current: max.slots,
            recovery: 'short'
          };
        } else {
          slots[level] = {
            max: max,
            current: max,
            recovery: 'long'
          };
        }
      });

      await actor.setFlag('ld-axyum', 'spellSlots', slots);
      return slots;
    } catch (err) {
      console.error('LD Axyum | Failed to initialize spell slots:', err);
      return null;
    }
  }

  /**
   * Consume spell slot
   */
  static async consumeSpellSlot(actor, spellLevel) {
    try {
      const slots = actor.getFlag('ld-axyum', 'spellSlots') || {};
      
      if (!slots[spellLevel] || slots[spellLevel].current <= 0) {
        ui.notifications?.warn?.(`No ${spellLevel === 0 ? 'cantrip' : `level ${spellLevel}`} slots available`);
        return false;
      }

      slots[spellLevel].current -= 1;
      await actor.setFlag('ld-axyum', 'spellSlots', slots);
      
      ui.notifications?.notify?.(`Consumed level ${spellLevel} spell slot`);
      return true;
    } catch (err) {
      console.error('LD Axyum | Failed to consume spell slot:', err);
      return false;
    }
  }

  /**
   * Recover spell slot
   */
  static async recoverSpellSlot(actor, spellLevel) {
    try {
      const slots = actor.getFlag('ld-axyum', 'spellSlots') || {};
      
      if (!slots[spellLevel] || slots[spellLevel].current >= slots[spellLevel].max) {
        ui.notifications?.warn?.(`Already at maximum ${spellLevel === 0 ? 'cantrips' : `level ${spellLevel}`} slots`);
        return false;
      }

      slots[spellLevel].current += 1;
      await actor.setFlag('ld-axyum', 'spellSlots', slots);
      
      ui.notifications?.notify?.(`Recovered level ${spellLevel} spell slot`);
      return true;
    } catch (err) {
      console.error('LD Axyum | Failed to recover spell slot:', err);
      return false;
    }
  }

  /**
   * Toggle spell preparation
   */
  static async toggleSpellPrepared(actor, spellId, prepared) {
    try {
      const item = actor.items.get(spellId);
      if (!item || item.type !== 'spell') {
        ui.notifications?.error?.('Spell not found');
        return false;
      }

      const update = {
        'system.preparation.prepared': !prepared
      };

      await item.update(update);
      ui.notifications?.notify?.(`Spell ${prepared ? 'unprepared' : 'prepared'}`);
      return true;
    } catch (err) {
      console.error('LD Axyum | Failed to toggle spell preparation:', err);
      return false;
    }
  }
}

// ES module export
export { SpellManagement };
