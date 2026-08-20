import assert from 'node:assert/strict';
import test from 'node:test';

test('wizard navigation previousPage succeeds off first page', async () => {
  const { WizardNavigation } = await import('../core/wizard-navigation.js');
  const nav = new WizardNavigation(['a', 'b', 'c']);
  assert.equal(nav.nextPage(), true);
  assert.equal(nav.previousPage(), true);
  assert.equal(nav.getCurrentPage(), 'a');
});

test('advantage tracker error paths, expired filters, and summary mapping', async () => {
  const { AdvantageDisadvantageTracker } = await import('../core/advantage-disadvantage-tracker.js');
  globalThis.foundry = { utils: { randomID: () => 'rid' } };
  globalThis.ui = { notifications: { notify: () => {} } };

  const boom = {
    getFlag: () => { throw new Error('flag boom'); },
    setFlag: async () => { throw new Error('set boom'); }
  };
  assert.equal(await AdvantageDisadvantageTracker.addAdvantage(boom, {}), null);
  assert.equal(await AdvantageDisadvantageTracker.addDisadvantage(boom, {}), null);
  assert.equal(await AdvantageDisadvantageTracker.removeAdvantage(boom, 'x'), false);
  assert.equal(await AdvantageDisadvantageTracker.removeDisadvantage(boom, 'x'), false);
  assert.equal(await AdvantageDisadvantageTracker.decrementDurations(boom), null);
  assert.equal(await AdvantageDisadvantageTracker.clearTemporaryEffects(boom), false);

  const flags = {
    advantages: [
      { id: 'a1', source: 'S', reason: 'R', type: 'attack', appliesTo: [], duration: -1 },
      { id: 'a2', source: 'S2', reason: 'R2', type: 'general', appliesTo: ['all'], duration: null },
      { id: 'a3', source: 'S3', reason: '', type: 'skill', appliesTo: ['skill'], duration: 2 }
    ],
    disadvantages: [
      { id: 'd1', source: 'D', reason: 'DR', type: 'attack', appliesTo: [], duration: -1 },
      { id: 'd2', source: 'D2', reason: '', type: 'general', appliesTo: ['all'], duration: 3 }
    ]
  };
  const actor = {
    getFlag: (_m, key) => flags[key],
    setFlag: async (_m, key, value) => { flags[key] = value; }
  };
  assert.equal(AdvantageDisadvantageTracker.getActiveAdvantages(actor, 'attack').length, 0);
  assert.ok(AdvantageDisadvantageTracker.getActiveAdvantages(actor, 'general').some((a) => a.id === 'a2'));
  assert.ok(AdvantageDisadvantageTracker.getActiveAdvantages(actor, 'skill').some((a) => a.id === 'a3'));
  assert.equal(AdvantageDisadvantageTracker.getActiveDisadvantages(actor, 'attack').length, 0);
  assert.ok(AdvantageDisadvantageTracker.getActiveDisadvantages(actor, 'general').some((d) => d.id === 'd2'));
  assert.equal(AdvantageDisadvantageTracker.hasAdvantageOverDisadvantage(actor, 'attack'), 'neutral');
  assert.equal(AdvantageDisadvantageTracker.hasAdvantageOverDisadvantage(actor, 'skill'), 'advantage');

  flags.advantages = [{ id: 'only', source: 'A', type: 'attack', appliesTo: [], duration: null }];
  flags.disadvantages = [];
  assert.equal(AdvantageDisadvantageTracker.hasAdvantageOverDisadvantage(actor, 'attack'), 'advantage');
  flags.advantages = [];
  flags.disadvantages = [{ id: 'onlyd', source: 'D', type: 'attack', appliesTo: [], duration: null }];
  assert.equal(AdvantageDisadvantageTracker.hasAdvantageOverDisadvantage(actor, 'attack'), 'disadvantage');

  flags.advantages = [
    { id: 't1', source: 'T', reason: 'r', type: 'general', appliesTo: [], duration: 1, isTemporary: false },
    { id: 't2', source: 'T2', reason: 'r2', type: 'general', appliesTo: [], duration: null }
  ];
  flags.disadvantages = [
    { id: 'td1', source: 'TD', reason: 'dr', type: 'general', appliesTo: [], duration: 1 },
    { id: 'td2', source: 'TD2', reason: 'obj', type: 'general', appliesTo: [], duration: { type: 'until', condition: 'end' } }
  ];
  await AdvantageDisadvantageTracker.decrementDurations(actor);
  const summary = AdvantageDisadvantageTracker.getSummary(actor);
  assert.ok(summary.totalAdvantages >= 1);
  assert.ok(summary.advantages[0].source);
  assert.ok(summary.disadvantages.length >= 0);
  assert.ok(['advantage', 'disadvantage', 'neutral'].includes(summary.resultingState));

  assert.ok(AdvantageDisadvantageTracker.getConditionAdvantage('prone'));
  assert.equal(AdvantageDisadvantageTracker.getConditionAdvantage('not-a-condition'), null);
});

test('character exporter covers null actor, spells, features, homebrew, conditions, download error', async () => {
  const { CharacterExporter } = await import('../core/character-exporter.js');
  globalThis.game = { user: { name: 'GM' } };
  assert.throws(() => CharacterExporter.exportCharacter(null), /Actor is required/);

  const actor = {
    id: 'a1',
    name: 'Bard Hero',
    system: {
      details: {
        race: 'Human', class: 'Bard', subclass: 'Lore', background: 'Entertainer',
        alignment: 'CG', level: 5, biography: 'sings', appearance: 'colorful'
      },
      abilities: { str: 10, dex: 14, con: 12, int: 10, wis: 10, cha: 16 },
      attributes: {
        ac: { value: 14 },
        hp: { value: 30, max: 30, temp: 0 },
        movement: { walk: 30 }
      },
      traits: {
        armorProf: { value: ['light'] },
        weaponProf: { value: ['simple'] },
        toolProf: { value: [] },
        languages: { value: ['common'] }
      },
      spells: {
        spell1: { value: 4, max: 4 },
        spell2: { value: 2, max: 3 }
      }
    },
    items: [
      {
        type: 'spell', name: 'Vicious Mockery',
        system: {
          level: 0, school: 'enc', activation: { type: 'action' }, range: { value: 60 },
          components: { vocal: true, somatic: false, material: false },
          duration: { value: 'instant' }, description: { value: 'insult' }, preparation: { prepared: false }
        },
        getFlag: () => 'phb'
      },
      {
        type: 'spell', name: 'Cure Wounds',
        system: {
          level: 1, school: 'evo', preparation: { prepared: true },
          components: {}, duration: {}, description: { value: 'heal' }
        },
        getFlag: () => null
      },
      {
        type: 'spell', name: 'Faerie Fire',
        system: {
          level: 1, school: 'evo', preparation: { prepared: false },
          components: {}, duration: {}, description: { value: 'glow' }
        },
        getFlag: () => null
      },
      {
        type: 'feature', name: 'Bardic Inspiration',
        system: { description: { value: 'inspire' }, prerequisite: '' },
        getFlag: (_s, k) => (k === 'level' ? 1 : 'official')
      },
      {
        type: 'weapon', name: 'Rapier',
        system: { quantity: 1, equipped: true, rarity: 'common', value: 25, weight: 2, description: { value: 'blade' } },
        getFlag: () => 'official'
      }
    ],
    flags: {
      'ld-axyum': {
        isMulticlass: true,
        multiclass: { active: true, classes: ['bard'], totalLevel: 5 },
        asiSelections: { 4: { type: 'asi', improvements: ['cha'] }, empty: {} },
        feats: { f1: { name: 'Actor', source: 'phb', level: 4, description: 'd', prerequisites: '' }, f2: null },
        homebrewFeats: { a: { id: 'a', name: 'HB Feat', description: 'x', prerequisites: [], source: 'homebrew' } },
        homebrewFeatures: { b: { id: 'b', name: 'HB Feat Feature', description: 'y', source: 'homebrew' } },
        homebrewSpells: { c: { id: 'c', name: 'HB Spell', level: 1, school: 'evo', description: 'z', source: 'homebrew' } }
      },
      dnd5e: {
        conditions: { poison: true, blind: true },
        temporaryAbilities: { cha: 2 },
        temporaryAC: 1,
        temporaryResistances: { fire: true }
      }
    },
    getFlag: (scope, key) => actor.flags[scope]?.[key],
    appliedEffects: [
      { name: 'Bless', label: 'Bless', duration: { rounds: 10 }, changes: [{ key: 'system.bonuses.abilities.check', value: '+1d4' }] },
      { name: 'Permanent', label: 'P', duration: {}, changes: [] }
    ]
  };

  const exported = CharacterExporter.exportCharacter(actor);
  assert.equal(exported.character.name, 'Bard Hero');
  assert.ok(exported.class?.spellSlots?.level1);
  assert.ok(exported.spells.cantrips.length >= 1);
  assert.ok(exported.spells.prepared.length >= 1);
  assert.ok(exported.spells.known.length >= 1);
  assert.ok(exported.features.some((f) => f.name === 'Bardic Inspiration'));
  assert.ok(exported.homebrew.feats.length >= 1);
  assert.ok(exported.homebrew.features.length >= 1);
  assert.ok(exported.homebrew.spells.length >= 1);
  assert.ok(exported.conditions.active.includes('poison'));
  assert.ok(exported.conditions.temporary.some((t) => t.type === 'effects'));
  assert.ok(exported.conditions.temporary.some((t) => t.type === 'abilities'));
  assert.ok(exported.conditions.temporary.some((t) => t.type === 'ac'));
  assert.ok(exported.conditions.temporary.some((t) => t.type === 'resistances'));

  const fail = await CharacterExporter.downloadCharacterJSON(null);
  assert.equal(fail.success, false);

  // non-bard/sorcerer unprepared spells land in available
  const wizardActor = {
    ...actor,
    name: 'Wizard Hero',
    system: {
      ...actor.system,
      details: { ...actor.system.details, class: 'Wizard' },
      spells: {}
    },
    items: [
      {
        type: 'spell', name: 'Magic Missile',
        system: { level: 1, preparation: { prepared: false }, components: {}, duration: {}, description: {} },
        getFlag: () => null
      }
    ],
    flags: { 'ld-axyum': {}, dnd5e: {} },
    getFlag: () => null,
    appliedEffects: []
  };
  const wizExport = CharacterExporter.exportCharacter(wizardActor);
  assert.ok(wizExport.spells.available.some((s) => s.name === 'Magic Missile'));
});

test('level scaler progression helpers and warlock mid slots', async () => {
  const LevelScaler = (await import('../core/level-scaler.js')).default;
  const scaler = new LevelScaler();
  assert.ok(scaler.calculateSpellSlots(6, 'warlock'));
  assert.ok(scaler.calculateSpellSlots(12, 'warlock'));
  assert.ok(scaler.calculateSpellSlots(18, 'warlock'));
  assert.ok(scaler.calculateSpellSlots(2, 'warlock'));
  const table = scaler.generateProgressionTable('fighter', 1);
  assert.equal(table.length, 20);
  assert.equal(scaler.getRecommendedStartingScore(1, true), 16);
  assert.equal(scaler.getRecommendedStartingScore(8, true) <= 20, true);
  assert.equal(scaler.getRecommendedStartingScore(1, false), 14);
  assert.equal(scaler.getRecommendedStartingScore(12, false) <= 20, true);
  assert.ok(Number.isInteger(scaler.getExpectedModifier(15, 8, 'standard')));
  assert.ok(Number.isInteger(scaler.getExpectedModifier(15, 8, 'focused')));
  assert.ok(Number.isInteger(scaler.getExpectedModifier(15, 8, 'distributed')));
  assert.ok(Number.isInteger(scaler.getExpectedModifier(15, 4, 'other')));
});

test('proficiency automation empty branches, errors, and class defaults', async () => {
  const { ProficiencyBonusAutomation } = await import('../core/proficiency-bonus-automation.js');
  globalThis.ui = { notifications: { notify: () => {}, warn: () => {} } };
  const empty = { level: 5, proficiencies: {} };
  assert.equal(ProficiencyBonusAutomation.getSkillProficiencyBonus({}, empty, 'arcana'), 0);
  assert.equal(ProficiencyBonusAutomation.getSkillProficiencyBonus({}, {
    level: 5, proficiencies: { skills: [{ name: 'stealth', expertise: false }] }
  }, 'arcana'), 0);
  assert.equal(ProficiencyBonusAutomation.getSavingThrowProficiencyBonus({}, empty, 'int'), 0);
  assert.equal(ProficiencyBonusAutomation.getAttackProficiencyBonus({}, empty, 'simple'), 0);
  assert.equal(ProficiencyBonusAutomation.getAttackProficiencyBonus({}, {
    level: 5, proficiencies: { weapons: ['all'] }
  }, 'longsword'), 3);
  assert.equal(ProficiencyBonusAutomation.getArmorProficiencyBonus({}, empty, 'light'), 0);
  assert.equal(ProficiencyBonusAutomation.getArmorProficiencyBonus({}, {
    level: 5, proficiencies: { armor: ['all'] }
  }, 'heavy'), 1);
  assert.equal(ProficiencyBonusAutomation.isToolProficient({ proficiencies: {} }, 'x'), false);
  assert.equal(ProficiencyBonusAutomation.isToolProficient({
    proficiencies: { tools: [{ name: 'all' }] }
  }, 'smith'), true);
  assert.equal(ProficiencyBonusAutomation.knowsLanguage({ proficiencies: {} }, 'common'), false);
  assert.equal(ProficiencyBonusAutomation.getPassiveSkillScore({ level: 5, proficiencies: {} }, 'arcana', 2), 12);
  assert.equal(ProficiencyBonusAutomation.getPassiveSkillScore({
    level: 5, proficiencies: { skills: [{ name: 'arcana', expertise: false }] }
  }, 'arcana', 2), 15);
  assert.equal(ProficiencyBonusAutomation.getPassiveSkillScore({
    level: 5, proficiencies: { skills: [{ name: 'arcana', expertise: true }] }
  }, 'arcana', 2), 18);

  const badRoll = { get _formula() { throw new Error('formula'); }, set _formula(_) {} };
  assert.equal(ProficiencyBonusAutomation.applyProficiencyToRoll(null, 2), null);
  assert.ok(ProficiencyBonusAutomation.applyProficiencyToRoll(badRoll, 2));

  const boomUi = { notifications: { notify: () => { throw new Error('ui'); } } };
  globalThis.ui = boomUi;
  assert.equal(ProficiencyBonusAutomation.updateProficiencyForLevelUp({}, 4, 5), null);
  globalThis.ui = { notifications: { notify: () => {} } };
  assert.equal(ProficiencyBonusAutomation.updateProficiencyForLevelUp({}, 1, 5), 3);
  assert.equal(ProficiencyBonusAutomation.updateProficiencyForLevelUp({}, 5, 5), 3);

  for (const id of [
    'barbarian', 'bard', 'cleric', 'druid', 'fighter', 'monk', 'paladin',
    'ranger', 'rogue', 'sorcerer', 'warlock', 'wizard', 'unknown'
  ]) {
    const defs = ProficiencyBonusAutomation.getDefaultClassProficiencies(id);
    assert.ok(Array.isArray(defs.weapons));
    assert.ok(Array.isArray(defs.skills));
  }
  assert.ok(ProficiencyBonusAutomation.generateProficiencySummary({}).skills);
});

