/**
 * Derived Stats Calculator Module
 * Handles calculation of skill bonuses, saving throws, spell DCs/attacks, and complete derived stats
 * Part of LD Axyum rules-engine.js refactoring
 */

export class DerivedStatsCalculator {
  /**
   * Calculate all derived stats for a character
   * @param {Object} characterData - Character data
   * @param {Object} calculators - Calculator instances for delegation
   * @returns {Object} Object with all calculated values
   */
  static calculateAllDerivedStats(characterData, calculators) {
    const { AbilityCalculator, CombatCalculator, SpellcastingCalculator, MulticlassCalculator } = calculators;
    
    const abilities = characterData.abilities;
    const className = characterData.class.name;
    const level = characterData.class.level;

    const abilityMods = AbilityCalculator.getAbilityModifiers(abilities);

    // Handle Multiclassing
    if (characterData.isMulticlass && characterData.classes?.length > 0) {
      const classes = characterData.classes;
      const totalLevel = classes.reduce((sum, c) => sum + (c.level || 1), 0);
      
      // Check if any class is a spellcaster
      const isSpellcaster = MulticlassCalculator.isMulticlassSpellcaster(
        classes,
        (className) => SpellcastingCalculator.isSpellcaster(className)
      );
      
      // Calculate total cantrips
      let cantripCount = 0;
      for (const c of classes) {
        cantripCount += SpellcastingCalculator.getCantripCount(c.name, c.level || 1);
      }

      return {
        abilityModifiers: abilityMods,
        proficiencyBonus: AbilityCalculator.getProficiencyBonus(totalLevel),
        hitPoints: MulticlassCalculator.getMulticlassHP(
          classes,
          abilityMods.con,
          (className) => CombatCalculator.getHitDie(className)
        ),
        armorClass: CombatCalculator.calculateArmorClass({
          dexModifier: abilityMods.dex,
          armorAC: 10 // Default unarmored
        }),
        spellSlots: MulticlassCalculator.calculateMulticlassSpellSlots(classes),
        cantripCount: cantripCount,
        isSpellcaster: isSpellcaster,
        maxSpellLevel: Math.ceil(totalLevel / 2) // Approximate max spell level
      };
    }

    // Single Class
    return {
      abilityModifiers: abilityMods,
      proficiencyBonus: AbilityCalculator.getProficiencyBonus(level),
      hitPoints: CombatCalculator.calculateHitPoints({
        className,
        level,
        conModifier: abilityMods.con
      }),
      armorClass: CombatCalculator.calculateArmorClass({
        dexModifier: abilityMods.dex,
        armorAC: 10 // Default unarmored
      }),
      spellSlots: SpellcastingCalculator.getSpellSlots(className, level),
      cantripCount: SpellcastingCalculator.getCantripCount(className, level),
      isSpellcaster: SpellcastingCalculator.isSpellcaster(className),
      maxSpellLevel: Math.ceil(level / 2) // Approximate max spell level
    };
  }

  /**
   * Calculate skill bonus
   * @param {Object} options - Skill calculation options
   * @returns {number} Total skill bonus
   */
  static calculateSkillBonus(options) {
    const {
      abilityModifier = 0,
      proficient = false,
      expertise = false,
      proficiencyBonus = 2,
      otherBonus = 0
    } = options;

    let bonus = abilityModifier;
    
    if (expertise) {
      bonus += proficiencyBonus * 2;
    } else if (proficient) {
      bonus += proficiencyBonus;
    }
    
    bonus += otherBonus;
    
    return bonus;
  }

  /**
   * Calculate passive skill score
   * @param {number} skillBonus - Total skill bonus
   * @returns {number} Passive score (10 + skill bonus)
   */
  static calculatePassiveScore(skillBonus) {
    return 10 + skillBonus;
  }

  /**
   * Get all skills with calculated bonuses
   * @param {Object} characterData - Character data
   * @param {Object} calculators - Calculator instances for delegation
   * @returns {Array} Array of skill objects with calculated totals
   */
  static calculateAllSkills(characterData, calculators) {
    const { AbilityCalculator } = calculators;
    
    const abilities = characterData.abilities || {};
    const modifiers = AbilityCalculator.getAbilityModifiers(abilities);
    const profBonus = AbilityCalculator.getProficiencyBonus(characterData.totalLevel || characterData.class?.level || 1);
    const skills = characterData.skills || {};
    
    const skillDefinitions = [
      { key: 'acrobatics', name: 'Acrobatics', ability: 'dex' },
      { key: 'animalHandling', name: 'Animal Handling', ability: 'wis' },
      { key: 'arcana', name: 'Arcana', ability: 'int' },
      { key: 'athletics', name: 'Athletics', ability: 'str' },
      { key: 'deception', name: 'Deception', ability: 'cha' },
      { key: 'history', name: 'History', ability: 'int' },
      { key: 'insight', name: 'Insight', ability: 'wis' },
      { key: 'intimidation', name: 'Intimidation', ability: 'cha' },
      { key: 'investigation', name: 'Investigation', ability: 'int' },
      { key: 'medicine', name: 'Medicine', ability: 'wis' },
      { key: 'nature', name: 'Nature', ability: 'int' },
      { key: 'perception', name: 'Perception', ability: 'wis' },
      { key: 'performance', name: 'Performance', ability: 'cha' },
      { key: 'persuasion', name: 'Persuasion', ability: 'cha' },
      { key: 'religion', name: 'Religion', ability: 'int' },
      { key: 'sleightOfHand', name: 'Sleight of Hand', ability: 'dex' },
      { key: 'stealth', name: 'Stealth', ability: 'dex' },
      { key: 'survival', name: 'Survival', ability: 'wis' }
    ];

    return skillDefinitions.map(skill => {
      const skillData = skills[skill.key] || { proficient: false, expertise: false };
      const abilityMod = modifiers[skill.ability] || 0;
      
      const total = this.calculateSkillBonus({
        abilityModifier: abilityMod,
        proficient: skillData.proficient,
        expertise: skillData.expertise,
        proficiencyBonus: profBonus
      });

      return {
        key: skill.key,
        name: skill.name,
        ability: skill.ability.toUpperCase(),
        proficient: skillData.proficient,
        expertise: skillData.expertise,
        total: total
      };
    });
  }

  /**
   * Calculate saving throw bonuses
   * @param {Object} characterData - Character data
   * @param {Object} calculators - Calculator instances for delegation
   * @returns {Array} Array of saving throw objects
   */
  static calculateSavingThrows(characterData, calculators) {
    const { AbilityCalculator } = calculators;
    
    const abilities = characterData.abilities || {};
    const modifiers = AbilityCalculator.getAbilityModifiers(abilities);
    const profBonus = AbilityCalculator.getProficiencyBonus(characterData.totalLevel || characterData.class?.level || 1);
    const saves = characterData.savingThrows || {};

    const savingThrows = [
      { key: 'str', name: 'Strength' },
      { key: 'dex', name: 'Dexterity' },
      { key: 'con', name: 'Constitution' },
      { key: 'int', name: 'Intelligence' },
      { key: 'wis', name: 'Wisdom' },
      { key: 'cha', name: 'Charisma' }
    ];

    return savingThrows.map(save => {
      const saveData = saves[save.key] || { proficient: false };
      const total = modifiers[save.key] + (saveData.proficient ? profBonus : 0) + (saveData.bonus || 0);

      return {
        key: save.key,
        name: save.name,
        proficient: saveData.proficient,
        total: total
      };
    });
  }

  /**
   * Calculate spell save DC
   * @param {Object} options - Options
   * @returns {number} Spell save DC
   */
  static calculateSpellSaveDC(options) {
    const {
      spellcastingAbility = 'int',
      abilityModifier = 0,
      proficiencyBonus = 2,
      otherBonus = 0
    } = options;

    return 8 + proficiencyBonus + abilityModifier + otherBonus;
  }

  /**
   * Calculate spell attack bonus
   * @param {Object} options - Options
   * @returns {number} Spell attack bonus
   */
  static calculateSpellAttackBonus(options) {
    const {
      abilityModifier = 0,
      proficiencyBonus = 2,
      otherBonus = 0
    } = options;

    return proficiencyBonus + abilityModifier + otherBonus;
  }

  /**
   * Calculate carrying capacity
   * @param {number} strScore - Strength score
   * @returns {number} Carrying capacity in pounds
   */
  static calculateCarryingCapacity(strScore) {
    return (strScore || 10) * 15;
  }

  /**
   * Check if character is encumbered
   * @param {number} currentWeight - Current carrying weight
   * @param {number} strScore - Strength score
   * @returns {Object} Encumbrance status
   */
  static checkEncumbrance(currentWeight, strScore) {
    const capacity = this.calculateCarryingCapacity(strScore);
    // PHB encumbrance variant: encumbered above 5x STR, heavily above 10x STR.
    // capacity/3 and (2/3)*capacity already equal 5x/10x STR — compare directly.
    const encumberedAt = capacity / 3;
    const heavilyEncumberedAt = (capacity * 2) / 3;

    return {
      current: currentWeight,
      max: capacity,
      encumbered: currentWeight > encumberedAt,
      heavilyEncumbered: currentWeight > heavilyEncumberedAt
    };
  }

  /**
   * Get ability score array with modifiers
   * @param {Object} abilities - Abilities object
   * @param {Object} calculators - Calculator instances for delegation
   * @returns {Array} Array of ability objects
   */
  static getAbilityScoresArray(abilities, calculators) {
    const { AbilityCalculator } = calculators;
    const modifiers = AbilityCalculator.getAbilityModifiers(abilities);
    
    return [
      { key: 'str', score: abilities.str || 10, modifier: modifiers.str },
      { key: 'dex', score: abilities.dex || 10, modifier: modifiers.dex },
      { key: 'con', score: abilities.con || 10, modifier: modifiers.con },
      { key: 'int', score: abilities.int || 10, modifier: modifiers.int },
      { key: 'wis', score: abilities.wis || 10, modifier: modifiers.wis },
      { key: 'cha', score: abilities.cha || 10, modifier: modifiers.cha }
    ];
  }
}
