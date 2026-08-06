/**
 * D&D 5e Actor Adapter
 * Translates Axyum character data to Foundry D&D 5e actor format
 */

export class Dnd5eActorAdapter {
  /**
   * Create a Foundry actor from Axyum character data
   * @param {Object} characterData - Axyum character data
   * @param {Object} options - Creation options
   * @returns {Promise<Actor>} Created Foundry actor
   */
  static async createActor(characterData, options = {}) {
    const actorData = this._convertToFoundryFormat(characterData);

    const actor = await Actor.create({
      name: characterData.name,
      type: 'character',
      img: characterData.details?.portrait || 'icons/svg/mystery-man.svg',
      system: actorData,
      flags: { core: { sheetClass: 'ld-axyum.Dnd5eCharacterSheet' } },
      ...options
    });

    return actor;
  }

  /**
   * Update an existing actor with Axyum character data
   * @param {Actor} actor - Foundry actor to update
   * @param {Object} characterData - Axyum character data
   */
  static async updateActor(actor, characterData) {
    const actorData = this._convertToFoundryFormat(characterData);
    await actor.update({ system: actorData });
  }

  /**
   * Convert Axyum character data to Foundry D&D 5e format
   * @param {Object} characterData - Axyum character data
   * @returns {Object} Foundry actor system data
   * @private
   */
  static _convertToFoundryFormat(characterData) {
    // NOTE: In dnd5e v5.x (Foundry v13), details.background, details.race, and classes
    // are LocalDocumentField types that require actual BaseItem instances.
    // Do NOT set them here — they are added as embedded items by createEmbeddedItems().
    return {
      // Basic info (only plain-value fields, no LocalDocumentField references)
      details: {
        alignment: characterData.alignment || '',
        biography: {
          value: characterData.biography || '',
          public: characterData.publicBio || ''
        }
      },

      // Abilities
      abilities: this._convertAbilities(characterData.abilities),

      // Hit points and hit dice
      attributes: {
        hp: {
          value: characterData.hitPoints?.current || 0,
          max: characterData.hitPoints?.max || 0,
          temp: characterData.hitPoints?.temp || 0
        },
        death: { success: 0, failure: 0 }
      },

      // Skills
      skills: this._convertSkills(characterData.skills),

      // Equipment
      currency: characterData.currency || { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 },

      // Features and traits
      traits: this._convertTraits(characterData.traits)
    };
  }

  /**
   * Convert ability scores to Foundry format
   * @param {Object} abilities - Axyum ability scores
   * @returns {Object} Foundry ability format
   * @private
   */
  static _convertAbilities(abilities) {
    const foundryAbilities = {};

    const abilityMap = {
      str: 'str', dex: 'dex', con: 'con',
      int: 'int', wis: 'wis', cha: 'cha'
    };

    for (const [axyumKey, foundryKey] of Object.entries(abilityMap)) {
      if (abilities[axyumKey]) {
        foundryAbilities[foundryKey] = {
          value: abilities[axyumKey],
          proficient: 0 // Will be calculated by proficiency system
        };
      }
    }

    return foundryAbilities;
  }

  /**
   * Convert class data to Foundry format
   * @param {Object} classData - Axyum class data
   * @returns {Object} Foundry classes format
   * @private
   */
  static _convertClasses(classData) {
    if (!classData) return {};

    return {
      [classData.id]: {
        name: classData.name,
        level: classData.level || 1,
        hitDice: classData.hitDie || 'd8',
        hitDiceUsed: 0
      }
    };
  }

  /**
   * Convert skills to Foundry format
   * @param {Object} skills - Axyum skills data
   * @returns {Object} Foundry skills format
   * @private
   */
  static _convertSkills(skills) {
    if (!skills) return {};

    const foundrySkills = {};
    const skillMap = {
      acrobatics: 'acr', animalHandling: 'ani', arcana: 'arc',
      athletics: 'ath', deception: 'dec', history: 'his',
      insight: 'ins', intimidation: 'itm', investigation: 'inv',
      medicine: 'med', nature: 'nat', perception: 'prc',
      performance: 'prf', persuasion: 'per', religion: 'rel',
      sleightOfHand: 'slt', stealth: 'ste', survival: 'sur'
    };
    // Foundry's skill schema defaults "ability" to dex when it's left unset,
    // so every skill must get its real governing ability explicitly.
    const skillAbility = {
      acr: 'dex', ani: 'wis', arc: 'int', ath: 'str', dec: 'cha',
      his: 'int', ins: 'wis', itm: 'cha', inv: 'int', med: 'wis',
      nat: 'int', prc: 'wis', prf: 'cha', per: 'cha', rel: 'int',
      slt: 'dex', ste: 'dex', sur: 'wis'
    };

    for (const [axyumKey, foundryKey] of Object.entries(skillMap)) {
      if (skills[axyumKey]) {
        foundrySkills[foundryKey] = {
          value: skills[axyumKey].proficient ? 1 : 0,
          bonus: skills[axyumKey].expertise ? 2 : 0,
          ability: skillAbility[foundryKey]
        };
      }
    }

    return foundrySkills;
  }

  /**
   * Convert proficiencies to Foundry format
   * @param {Object} proficiencies - Axyum proficiencies
   * @returns {Object} Foundry proficiencies format
   * @private
   */
  static _convertProficiencies(proficiencies) {
    return {
      armor: proficiencies?.armor || [],
      weapons: proficiencies?.weapons || [],
      tools: proficiencies?.tools || []
    };
  }

  /**
   * Convert spells to Foundry format
   * @param {Array} spells - Axyum spells data
   * @returns {Object} Foundry spells format
   * @private
   */
  static _convertSpells(spells) {
    // Spells are stored as an array; if not provided, treat as empty
    const spellList = Array.isArray(spells) ? spells : (spells && typeof spells === 'object' ? Object.values(spells) : []);
    if (spellList.length === 0) return {};

    const foundrySpells = {};

    // Group spells by level
    for (let level = 0; level <= 9; level++) {
      const levelSpells = spellList.filter(spell => spell?.level === level);
      if (levelSpells.length > 0) {
        foundrySpells[`spell${level}`] = levelSpells.map(spell => ({
          name: spell.name,
          prepared: spell.prepared || false,
          uses: { value: spell.uses?.current || 0, max: spell.uses?.max || 0 }
        }));
      }
    }

    return foundrySpells;
  }

  /**
   * Convert traits to Foundry format
   * @param {Object} traits - Axyum traits data
   * @returns {Object} Foundry traits format
   * @private
   */
  static _convertTraits(traits) {
    return {
      languages: traits?.languages || [],
      weaponProf: traits?.weaponProficiencies || [],
      armorProf: traits?.armorProficiencies || [],
      toolProf: traits?.toolProficiencies || []
    };
  }
}