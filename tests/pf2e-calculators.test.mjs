import assert from 'node:assert/strict';
import test from 'node:test';

import { Pf2eProficiencyCalculator, PF2E_PROFICIENCY_RANKS } from '../systems/pf2e/rules/calculators/pf2e-proficiency-calculator.js';
import { Pf2eAbilityBoostCalculator } from '../systems/pf2e/rules/calculators/pf2e-ability-boost-calculator.js';
import { Pf2eCombatCalculator } from '../systems/pf2e/rules/calculators/pf2e-combat-calculator.js';
import { Pf2eFeatCalculator } from '../systems/pf2e/rules/calculators/pf2e-feat-calculator.js';
import { Pf2eSkillCalculator } from '../systems/pf2e/rules/calculators/pf2e-skill-calculator.js';
import { Pf2eSpellcastingCalculator } from '../systems/pf2e/rules/calculators/pf2e-spellcasting-calculator.js';
import { Pf2eRulesEngine } from '../systems/pf2e/rules/pf2e-rules-engine.js';

test('Pf2eProficiencyCalculator normalizes ranks and builds bonuses', () => {
  assert.equal(Pf2eProficiencyCalculator.normalizeRank(3), 3);
  assert.equal(Pf2eProficiencyCalculator.normalizeRank(-2), 0);
  assert.equal(Pf2eProficiencyCalculator.normalizeRank(99), 4);
  assert.equal(Pf2eProficiencyCalculator.normalizeRank('Expert'), 2);
  assert.equal(Pf2eProficiencyCalculator.normalizeRank('nope'), 0);
  assert.equal(Pf2eProficiencyCalculator.normalizeRank(null), 0);

  assert.equal(Pf2eProficiencyCalculator.getRankBonus('trained'), 2);
  assert.equal(Pf2eProficiencyCalculator.getRankBonus('legendary'), 8);

  assert.equal(Pf2eProficiencyCalculator.getProficiencyBonus('untrained', 5), 0);
  assert.equal(Pf2eProficiencyCalculator.getProficiencyBonus('trained', 5), 7);
  assert.equal(Pf2eProficiencyCalculator.getProficiencyBonus('trained', 5, { proficiencyWithoutLevel: true }), 2);
  assert.equal(Pf2eProficiencyCalculator.getProficiencyBonus('expert', 'x'), 4);

  assert.equal(Pf2eProficiencyCalculator.getRankLabel('master'), 'Master');
  assert.equal(Pf2eProficiencyCalculator.getRankLabel(0), 'Untrained');
  assert.deepEqual(PF2E_PROFICIENCY_RANKS, ['untrained', 'trained', 'expert', 'master', 'legendary']);
});

test('Pf2eAbilityBoostCalculator validates free boosts and exposes constants', () => {
  assert.equal(Pf2eAbilityBoostCalculator.applyBoost(18), 19);
  assert.equal(Pf2eAbilityBoostCalculator.applyBoost(16), 18);
  assert.equal(Pf2eAbilityBoostCalculator.applyFlaw(9), 8);
  assert.equal(Pf2eAbilityBoostCalculator.getModifier(15), 2);

  const tooMany = Pf2eAbilityBoostCalculator.validateFreeBoosts(['str', 'dex', 'con', 'int', 'wis']);
  assert.equal(tooMany.valid, false);
  assert.ok(tooMany.errors.some((e) => e.includes('Only 4 free')));

  const dup = Pf2eAbilityBoostCalculator.validateFreeBoosts(['str', 'str', 'dex', 'con']);
  assert.ok(dup.errors.some((e) => e.includes('STR')));

  const bad = Pf2eAbilityBoostCalculator.validateFreeBoosts(['str', 'dex', 'con', 'foo']);
  assert.ok(bad.errors.some((e) => e.includes('Unknown ability key: foo')));

  assert.deepEqual(Pf2eAbilityBoostCalculator.validateFreeBoosts(null), { valid: true, errors: [] });
  assert.equal(Pf2eAbilityBoostCalculator.FREE_BOOST_COUNT, 4);
  assert.deepEqual(Pf2eAbilityBoostCalculator.ABILITY_KEYS, ['str', 'dex', 'con', 'int', 'wis', 'cha']);
  assert.notEqual(Pf2eAbilityBoostCalculator.ABILITY_KEYS, Pf2eAbilityBoostCalculator.ABILITY_KEYS);
});

test('Pf2eCombatCalculator covers AC with and without dex caps', () => {
  assert.equal(Pf2eCombatCalculator.calculateHP({ ancestryHP: 8, classHPPerLevel: 10, level: 3, conModifier: 2 }), 44);
  assert.equal(Pf2eCombatCalculator.calculateHP(null), 0);

  assert.equal(Pf2eCombatCalculator.calculateAC({
    dexModifier: 4, armorRank: 'trained', dexCap: 2, itemBonus: 3, level: 1
  }), 10 + 2 + 3 + 3);

  assert.equal(Pf2eCombatCalculator.calculateAC({
    dexModifier: 4, armorRank: 'trained', level: 1
  }), 10 + 4 + 3);

  assert.equal(Pf2eCombatCalculator.calculateAC({
    dexModifier: 4, armorRank: 'trained', dexCap: Infinity, level: 1, proficiencyWithoutLevel: true
  }), 10 + 4 + 2);

  assert.equal(Pf2eCombatCalculator.calculateAC(null), 10 + 0 + 3);
  assert.equal(Pf2eCombatCalculator.calculateSave({ abilityModifier: 2, rank: 'expert', level: 3 }), 2 + 4 + 3);
  assert.equal(Pf2eCombatCalculator.calculatePerception({ wisModifier: 1, rank: 'trained', level: 2 }), 1 + 2 + 2);
  assert.equal(Pf2eCombatCalculator.calculateClassDC({ keyAbilityModifier: 3, rank: 'trained', level: 1 }), 10 + 3 + 3);
});

test('Pf2eFeatCalculator reports slots and prerequisite failures', () => {
  assert.deepEqual(Pf2eFeatCalculator.getFeatSlotsAtLevel(1), { ancestry: 1, class: 1, skill: 0, general: 0 });
  assert.deepEqual(Pf2eFeatCalculator.getFeatSlotsGrantedAtLevel(2), {
    ancestry: false, class: true, skill: true, general: false
  });
  assert.deepEqual(Pf2eFeatCalculator.getFeatSlotsGrantedAtLevel(3), {
    ancestry: false, class: false, skill: false, general: true
  });
  assert.deepEqual(Pf2eFeatCalculator.getFeatSlotsGrantedAtLevel(5), {
    ancestry: true, class: false, skill: false, general: false
  });

  assert.deepEqual(
    Pf2eFeatCalculator.validateFeatPrerequisites({ level: 5 }, { totalLevel: 3 }),
    { valid: false, message: 'Requires level 5' }
  );
  assert.deepEqual(
    Pf2eFeatCalculator.validateFeatPrerequisites({ level: 2 }, { level: 4 }),
    { valid: true, message: '' }
  );
  assert.deepEqual(
    Pf2eFeatCalculator.validateFeatPrerequisites(null, null),
    { valid: true, message: '' }
  );
});

test('Pf2eSkillCalculator budgets training and maps abilities', () => {
  assert.equal(Pf2eSkillCalculator.calculateSkillBonus({
    abilityModifier: 2, rank: 'trained', level: 3, armorPenalty: 1
  }), 2 + 2 + 3 - 1);
  assert.equal(Pf2eSkillCalculator.getTrainedSkillBudget(2, 3), 5);
  assert.equal(Pf2eSkillCalculator.getTrainedSkillBudget(-1, null), 0);
  assert.equal(Pf2eSkillCalculator.getTrainedSkillBudget('x', 'y'), 0);
  assert.equal(Pf2eSkillCalculator.getCoreSkillSlugs().length, 16);
  assert.equal(Pf2eSkillCalculator.getSkillAbility('stealth'), 'dex');
  assert.equal(Pf2eSkillCalculator.getSkillAbility('ghost'), null);
});

test('Pf2eSpellcastingCalculator builds slots DC and attack', () => {
  assert.deepEqual(Pf2eSpellcastingCalculator.getSpellSlots(1), [2, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  assert.equal(Pf2eSpellcastingCalculator.getCantripsKnown(8), 5 + 2);
  assert.equal(Pf2eSpellcastingCalculator.getMaxSpellRank(5), 3);
  assert.equal(Pf2eSpellcastingCalculator.calculateSpellDC({
    abilityModifier: 3, rank: 'trained', level: 1
  }), 10 + 3 + 3);
  assert.equal(Pf2eSpellcastingCalculator.calculateSpellDC(null), 10 + 0 + 3);
  assert.equal(Pf2eSpellcastingCalculator.calculateSpellAttack({
    abilityModifier: 3, rank: 'expert', level: 4, proficiencyWithoutLevel: true
  }), 3 + 4);
  assert.equal(Pf2eSpellcastingCalculator.calculateSpellAttack(null), 0 + 3);
});

test('Pf2eRulesEngine forwards every calculator facade method', () => {
  assert.equal(Pf2eRulesEngine.getProficiencyBonus('trained', 1), 3);
  assert.equal(Pf2eRulesEngine.getRankLabel('expert'), 'Expert');
  assert.equal(Pf2eRulesEngine.computeFinalAbilities({ freeBoosts: ['str'] }).str, 12);
  assert.equal(Pf2eRulesEngine.getAbilityModifiers({ str: 14 }).str, 2);
  assert.equal(Pf2eRulesEngine.getAbilityModifier(8), -1);
  assert.equal(Pf2eRulesEngine.validateFreeBoosts(['str']).valid, true);
  assert.equal(Pf2eRulesEngine.calculateHP({ ancestryHP: 8, classHPPerLevel: 8, level: 1, conModifier: 0 }), 16);
  assert.equal(Pf2eRulesEngine.calculateAC({ dexModifier: 1, armorRank: 'trained', level: 1 }), 14);
  assert.equal(Pf2eRulesEngine.calculateSave({ abilityModifier: 1, rank: 'trained', level: 1 }), 4);
  assert.equal(Pf2eRulesEngine.calculatePerception({ wisModifier: 1, rank: 'trained', level: 1 }), 4);
  assert.equal(Pf2eRulesEngine.calculateClassDC({ keyAbilityModifier: 2, rank: 'trained', level: 1 }), 15);
  assert.equal(Pf2eRulesEngine.calculateSkillBonus({ abilityModifier: 1, rank: 'trained', level: 1 }), 4);
  assert.equal(Pf2eRulesEngine.getTrainedSkillBudget(1, 2), 3);
  assert.ok(Pf2eRulesEngine.getCoreSkillSlugs().includes('arcana'));
  assert.equal(Pf2eRulesEngine.getSkillAbility('arcana'), 'int');
  assert.equal(Pf2eRulesEngine.getFeatSlotsAtLevel(1).class, 1);
  assert.equal(Pf2eRulesEngine.getFeatSlotsGrantedAtLevel(2).skill, true);
  assert.equal(Pf2eRulesEngine.validateFeatPrerequisites({ level: 1 }, { level: 1 }).valid, true);
  assert.deepEqual(Pf2eRulesEngine.getSpellSlots(1)[0], 2);
  assert.equal(Pf2eRulesEngine.getCantripsKnown(1), 5);
  assert.equal(Pf2eRulesEngine.getMaxSpellRank(1), 1);
  assert.equal(Pf2eRulesEngine.calculateSpellDC({ abilityModifier: 2, rank: 'trained', level: 1 }), 15);
  assert.equal(Pf2eRulesEngine.calculateSpellAttack({ abilityModifier: 2, rank: 'trained', level: 1 }), 5);
});
