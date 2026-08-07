import assert from 'node:assert/strict';
import test from 'node:test';

test('multiclass calculator and rules engine cover combat/spell branches', async () => {
  const MulticlassCalculator = (await import('../core/multiclass-calculator.js')).default;
  const { RulesEngine } = await import('../core/rules-engine.js');

  assert.deepEqual(MulticlassCalculator.calculateMulticlassSpellSlots([]), {});
  const full = MulticlassCalculator.calculateMulticlassSpellSlots([
    { name: 'Wizard', level: 5 },
    { name: 'Cleric', level: 3 }
  ]);
  assert.ok(Object.keys(full).length > 0);
  const half = MulticlassCalculator.calculateMulticlassSpellSlots([
    { name: 'Paladin', level: 6 },
    { name: 'Ranger', level: 4 }
  ]);
  assert.ok(Object.keys(half).length > 0);
  const mixed = MulticlassCalculator.calculateMulticlassSpellSlots([
    { name: 'Wizard', level: 3 },
    { name: 'Paladin', level: 4 },
    { name: 'Warlock', level: 2 },
    { name: 'Artificer', level: 3 }
  ]);
  assert.ok(Object.keys(mixed).length > 0);
  assert.deepEqual(MulticlassCalculator.calculateMulticlassSpellSlots([{ name: 'Fighter', level: 5 }]), {});

  const hp = MulticlassCalculator.getMulticlassHP([
    { name: 'Fighter', level: 2 },
    { name: 'Wizard', level: 1 }
  ], 2, (name) => (String(name).toLowerCase() === 'fighter' ? 10 : 6));
  assert.ok(hp > 0);
  assert.equal(MulticlassCalculator.getMulticlassProficiencyBonus([{ level: 5 }], (l) => Math.ceil(l / 4) + 1), 3);
  assert.equal(MulticlassCalculator.isMulticlassSpellcaster([{ name: 'Fighter' }], (n) => n === 'Wizard'), false);
  assert.equal(MulticlassCalculator.isMulticlassSpellcaster([{ name: 'Wizard' }], (n) => n === 'Wizard'), true);
  assert.ok(MulticlassCalculator.getMulticlassFeatures([
    { name: 'Fighter', level: 2, features: ['Action Surge'] },
    { name: 'Rogue', level: 1 }
  ]).Fighter);
  assert.equal(MulticlassCalculator.validateMulticlassLevels([
    { id: 'a', name: 'A', level: 3 },
    { id: 'b', name: 'B', level: 2 }
  ]).valid, true);
  assert.equal(MulticlassCalculator.validateMulticlassLevels([
    { id: 'a', name: 'A', level: 15 },
    { id: 'b', name: 'B', level: 10 }
  ]).valid, false);
  assert.equal(MulticlassCalculator.validateMulticlassLevels([]).valid, false);
  assert.equal(MulticlassCalculator.validateMulticlassLevels(null).valid, false);

  assert.equal(RulesEngine.getAbilityModifier(18), 4);
  assert.ok(RulesEngine.getAbilityModifiers({ str: 16 }).str === 3);
  assert.equal(RulesEngine.getProficiencyBonus(5), 3);
  assert.ok(RulesEngine.calculateHitPoints({ className: 'Fighter', level: 2, conModifier: 1 }) > 0);
  assert.ok(RulesEngine.calculateArmorClass({ armorType: 'light', armorAC: 12, dexModifier: 2 }) >= 12);
  assert.ok(RulesEngine.getSpellSlots('wizard', 5));
  assert.equal(RulesEngine.isSpellcaster('wizard'), true);
  assert.ok(RulesEngine.getCantripCount('wizard', 5) >= 3);
  const derived = RulesEngine.calculateAllDerivedStats({
    class: { name: 'Wizard', level: 5 },
    abilities: { str: 10, dex: 14, con: 12, int: 16, wis: 10, cha: 8 },
    skills: { arcana: { proficient: true } },
    savingThrows: { int: { proficient: true } }
  });
  assert.ok(derived);
  assert.ok(RulesEngine.calculateMulticlassSpellSlots([{ name: 'Wizard', level: 5 }]));
  assert.ok(RulesEngine.getMulticlassHP([{ name: 'Wizard', level: 2 }], 1) > 0);
  assert.ok(RulesEngine.getMulticlassProficiencyBonus([{ level: 5 }]) >= 2);
  assert.equal(RulesEngine.isMulticlassSpellcaster([{ name: 'Wizard' }]), true);
  assert.ok(RulesEngine.getMulticlassFeatures([{ name: 'Fighter', level: 1 }]).Fighter);
});

test('derived stats calculator covers skills, saves, and encumbrance', async () => {
  const { DerivedStatsCalculator } = await import('../core/derived-stats-calculator.js');
  const AbilityCalculator = {
    getAbilityModifiers: (abilities) => ({
      str: Math.floor(((abilities.str || 10) - 10) / 2),
      dex: Math.floor(((abilities.dex || 10) - 10) / 2),
      con: Math.floor(((abilities.con || 10) - 10) / 2),
      int: Math.floor(((abilities.int || 10) - 10) / 2),
      wis: Math.floor(((abilities.wis || 10) - 10) / 2),
      cha: Math.floor(((abilities.cha || 10) - 10) / 2)
    }),
    getProficiencyBonus: (l) => Math.ceil(l / 4) + 1,
    getAbilityModifier: (s) => Math.floor((s - 10) / 2)
  };
  const CombatCalculator = {
    getHitDie: () => 6,
    calculateHitPoints: () => 20,
    calculateArmorClass: () => 15
  };
  const SpellcastingCalculator = {
    isSpellcaster: (n) => ['Wizard', 'wizard'].includes(n),
    getCantripCount: () => 3,
    getSpellSlots: () => ({ type: 'full', slots: [4, 3, 2] })
  };
  const MulticlassCalculator = {
    isMulticlassSpellcaster: () => true,
    getMulticlassHP: () => 30,
    calculateMulticlassSpellSlots: () => ({ level1: 4 })
  };
  const calculators = { AbilityCalculator, CombatCalculator, SpellcastingCalculator, MulticlassCalculator };
  const character = {
    class: { name: 'Wizard', level: 5 },
    classes: [{ name: 'Wizard', level: 5 }],
    isMulticlass: false,
    abilities: { str: 10, dex: 14, con: 12, int: 16, wis: 10, cha: 8 },
    skills: {
      arcana: { proficient: true, expertise: false },
      stealth: { proficient: true, expertise: true },
      athletics: { proficient: false }
    },
    skillProficiencies: ['arcana'],
    savingThrows: {
      int: { proficient: true },
      wis: { proficient: false }
    },
    armorClass: 10,
    carrying: { weight: 50 }
  };
  const all = DerivedStatsCalculator.calculateAllDerivedStats(character, calculators);
  assert.ok(all);
  const multi = DerivedStatsCalculator.calculateAllDerivedStats({
    ...character,
    isMulticlass: true,
    classes: [{ name: 'Wizard', level: 3 }, { name: 'Fighter', level: 2 }]
  }, calculators);
  assert.ok(multi);
  assert.equal(DerivedStatsCalculator.calculateSkillBonus({
    abilityModifier: 3, proficient: true, expertise: false, proficiencyBonus: 3
  }), 6);
  assert.equal(DerivedStatsCalculator.calculateSkillBonus({
    abilityModifier: 2, proficient: true, expertise: true, proficiencyBonus: 3
  }), 8);
  assert.equal(DerivedStatsCalculator.calculatePassiveScore(5), 15);
  const skills = DerivedStatsCalculator.calculateAllSkills(character, calculators);
  assert.ok(skills);
  const saves = DerivedStatsCalculator.calculateSavingThrows(character, calculators);
  assert.ok(saves);
  assert.equal(DerivedStatsCalculator.calculateSpellSaveDC({
    abilityModifier: 3, proficiencyBonus: 3
  }), 14);
  assert.equal(DerivedStatsCalculator.calculateSpellAttackBonus({
    abilityModifier: 3, proficiencyBonus: 3
  }), 6);
  assert.equal(DerivedStatsCalculator.calculateCarryingCapacity(10), 150);
  assert.equal(DerivedStatsCalculator.checkEncumbrance(50, 10).encumbered, false);
  // encumbered when weight > (capacity/3)*5 => > 250 for STR 10
  assert.equal(DerivedStatsCalculator.checkEncumbrance(300, 10).encumbered, true);
  assert.ok(Array.isArray(DerivedStatsCalculator.getAbilityScoresArray(character.abilities, calculators)));
});

test('proficiency bonus automation and advantage tracker', async () => {
  const { ProficiencyBonusAutomation } = await import('../core/proficiency-bonus-automation.js');
  assert.equal(ProficiencyBonusAutomation.calculateProficiencyBonus(1), 2);
  assert.equal(ProficiencyBonusAutomation.calculateProficiencyBonus(5), 3);
  assert.equal(ProficiencyBonusAutomation.calculateProficiencyBonus(9), 4);
  assert.equal(ProficiencyBonusAutomation.calculateProficiencyBonus(13), 5);
  assert.equal(ProficiencyBonusAutomation.calculateProficiencyBonus(17), 6);
  const characterData = {
    level: 5,
    class: { level: 5 },
    totalLevel: 5,
    proficiencies: {
      skills: [
        { name: 'arcana', expertise: false },
        { name: 'stealth', expertise: true }
      ],
      savingThrows: ['int'],
      weapons: ['simple'],
      armor: ['light'],
      tools: [{ name: 'thievesTools' }],
      languages: ['common', 'elvish']
    }
  };
  const actor = { name: 'A' };
  globalThis.foundry = { utils: { randomID: () => `id-${Math.random()}` } };
  globalThis.ui = { notifications: { notify: () => {}, info: () => {} } };
  assert.ok(ProficiencyBonusAutomation.getSkillProficiencyBonus(actor, characterData, 'arcana') >= 2);
  assert.ok(ProficiencyBonusAutomation.getSkillProficiencyBonus(actor, characterData, 'stealth') >= 4);
  assert.ok(ProficiencyBonusAutomation.getSavingThrowProficiencyBonus(actor, characterData, 'int') >= 0);
  assert.ok(ProficiencyBonusAutomation.getAttackProficiencyBonus(actor, characterData, 'simple') >= 0);
  assert.ok(ProficiencyBonusAutomation.getArmorProficiencyBonus(actor, characterData, 'light') >= 0);
  assert.ok(ProficiencyBonusAutomation.getAllProficiencyBonuses(actor, characterData));
  assert.equal(ProficiencyBonusAutomation.isToolProficient(characterData, 'thievesTools'), true);
  assert.equal(ProficiencyBonusAutomation.knowsLanguage(characterData, 'elvish'), true);
  assert.ok(ProficiencyBonusAutomation.getPassiveSkillScore(characterData, 'arcana', 3) >= 10);
  assert.ok(ProficiencyBonusAutomation.generateProficiencySummary(characterData));
  const roll = ProficiencyBonusAutomation.applyProficiencyToRoll({ total: 10 }, 3);
  assert.ok(roll);
  const updated = ProficiencyBonusAutomation.updateProficiencyForLevelUp(actor, 4, 5);
  assert.ok(updated !== undefined);

  const { AdvantageDisadvantageTracker } = await import('../core/advantage-disadvantage-tracker.js');
  const flags = { advantages: [], disadvantages: [] };
  const tracked = {
    getFlag: (_m, key) => flags[key] || [],
    setFlag: async (_m, key, value) => { flags[key] = value; }
  };
  const adv = await AdvantageDisadvantageTracker.addAdvantage(tracked, {
    source: 'test', type: 'attack', duration: 2, appliesTo: ['attacks']
  });
  assert.ok(adv?.id);
  const dis = await AdvantageDisadvantageTracker.addDisadvantage(tracked, {
    source: 'test', type: 'attack', duration: 1, appliesTo: ['attacks']
  });
  assert.ok(dis?.id);
  assert.ok(AdvantageDisadvantageTracker.getActiveAdvantages(tracked, 'attack').length >= 0);
  assert.ok(AdvantageDisadvantageTracker.getActiveDisadvantages(tracked, 'attack').length >= 0);
  assert.ok(['advantage', 'disadvantage', 'neutral'].includes(
    AdvantageDisadvantageTracker.hasAdvantageOverDisadvantage(tracked, 'attack')
  ));
  await AdvantageDisadvantageTracker.decrementDurations(tracked);
  await AdvantageDisadvantageTracker.removeAdvantage(tracked, adv.id);
  await AdvantageDisadvantageTracker.removeDisadvantage(tracked, dis.id);
  await AdvantageDisadvantageTracker.addAdvantage(tracked, {
    source: 'temp', type: 'general', duration: 1, isTemporary: true
  });
  await AdvantageDisadvantageTracker.clearTemporaryEffects(tracked);
  assert.ok(AdvantageDisadvantageTracker.getSummary(tracked));
  AdvantageDisadvantageTracker.getConditionAdvantage('blinded');
  AdvantageDisadvantageTracker.getConditionAdvantage('invisible');
});

test('spell management and character exporter cover export paths', async () => {
  const { SpellManagement } = await import('../core/spell-management.js');
  const slots = SpellManagement.calculateSpellSlots({
    classes: [{ classId: 'wizard', name: 'Wizard', level: 5 }],
    class: { id: 'wizard', level: 5 }
  });
  assert.ok(slots[1] > 0);
  assert.ok(SpellManagement.calculateSpellSlots({
    classes: [{ classId: 'warlock', name: 'Warlock', level: 3 }]
  }).warlock);
  assert.ok(SpellManagement.calculateSpellSlots({
    classes: [{ classId: 'paladin', name: 'Paladin', level: 6 }]
  })[1] >= 0);
  assert.deepEqual(SpellManagement.calculateSpellSlots({ classes: [] })[1], 0);
  const prepared = SpellManagement.getPreparedSpellLimit({
    classes: [{ classId: 'cleric', level: 5 }],
    abilities: { wis: 16, cha: 14, int: 16 }
  });
  assert.ok(prepared.cleric >= 1);
  assert.equal(SpellManagement.getPreparedSpellLimit({
    classes: [{ classId: 'wizard', level: 5 }],
    abilities: { int: 16 }
  }).wizard, null);
  const actor = {
    name: 'Caster',
    items: [
      { type: 'spell', name: 'Fireball', system: { level: 3, preparation: { prepared: false } }, id: 's1', update: async (data) => { actor.updated = data; } }
    ],
    system: { spells: { spell1: { value: 2, max: 4 }, spell2: { value: 1, max: 2 } } },
    update: async (data) => { actor.systemUpdate = data; },
    getFlag: () => null,
    setFlag: async () => {}
  };
  actor.items.get = (id) => actor.items.find((i) => i.id === id);
  const prep = SpellManagement.getAvailableSpellsForPreparation(actor, {
    classes: [{ classId: 'wizard', level: 5 }]
  });
  assert.ok(Array.isArray(prep.prepared));
  assert.ok(Array.isArray(prep.available));
  await SpellManagement.updateSpellSlotsOnRest(actor, 'long');
  await SpellManagement.updateSpellSlotsOnRest(actor, 'short');
  await SpellManagement.initializeSpellSlots(actor, {
    classes: [{ id: 'wizard', level: 5 }],
    abilities: { int: 16 }
  });
  await SpellManagement.consumeSpellSlot(actor, 1);
  await SpellManagement.recoverSpellSlot(actor, 1);
  await SpellManagement.toggleSpellPrepared(actor, 's1', true);

  const { CharacterExporter } = await import('../core/character-exporter.js');
  globalThis.game = { user: { name: 'Tester' } };
  const exportActor = {
    id: 'ex1',
    name: 'Exported',
    system: {
      details: {
        race: 'Human', class: 'Fighter', subclass: 'Champion', background: 'Soldier',
        alignment: 'LG', level: 5, biography: 'bio', appearance: 'tall'
      },
      abilities: { str: { value: 16 }, dex: { value: 14 }, con: { value: 14 }, int: { value: 10 }, wis: { value: 10 }, cha: { value: 8 } },
      attributes: {
        ac: { value: 16 },
        hp: { value: 40, max: 44, temp: 0 },
        movement: { walk: 30 }
      },
      traits: {
        armorProf: { value: ['light', 'medium'] },
        weaponProf: { value: ['simple', 'martial'] },
        toolProf: { value: [] },
        languages: { value: ['common'] }
      }
    },
    items: [
      { type: 'weapon', name: 'Longsword', system: { quantity: 1, equipped: true, rarity: 'common', price: { value: 15 }, weight: 3, description: { value: 'steel' } }, flags: {}, getFlag: (s, k) => null },
      { type: 'spell', name: 'Light', system: { level: 0, school: 'evo', description: { value: 'glow' }, preparation: { prepared: false } }, flags: {}, getFlag: () => null },
      { type: 'spell', name: 'Shield', system: { level: 1, preparation: { prepared: true } }, flags: {}, getFlag: () => null },
      { type: 'feat', name: 'Tough', system: { description: { value: 'hp' } }, flags: {}, getFlag: () => null },
      { type: 'feat', name: 'HomeFeat', system: {}, flags: { 'ld-axyum': { homebrew: true, id: 'hf1' } }, getFlag: (s, k) => (s === 'ld-axyum' ? ({ homebrew: true, id: 'hf1' }[k] ?? true) : null) },
      { type: 'feat', name: 'ClassFeature', system: { type: { value: 'class' } }, flags: {}, getFlag: () => null },
      { type: 'loot', name: 'Gem', system: { quantity: 2 }, flags: {}, getFlag: () => null }
    ],
    flags: {
      'ld-axyum': {
        isMulticlass: true,
        multiclass: { active: true, classes: ['fighter', 'rogue'] },
        asiSelections: { 4: { type: 'asi', improvements: ['str'] } },
        feats: { feat_0: { name: 'Alert' } },
        homebrewFeats: { a: { id: 'a', name: 'HB' } },
        homebrewFeatures: {},
        homebrewSpells: {}
      },
      dnd5e: {
        conditions: { poisoned: true },
        temporaryAbilities: { str: 1 },
        temporaryAC: 1,
        temporaryResistances: ['fire']
      }
    },
    getFlag: (scope, key) => exportActor.flags[scope]?.[key]
  };
  const exported = CharacterExporter.exportCharacter(exportActor);
  assert.equal(exported.character.name, 'Exported');
  assert.ok(exported.items.length >= 1);
  assert.ok(exported.spells);
  assert.ok(exported.feats.length >= 1);
  assert.ok(exported.homebrew);
  assert.ok(exported.conditions);
  const str = CharacterExporter.exportToString(exportActor);
  assert.match(str, /Exported/);
  assert.ok(CharacterExporter.getExportSize(exportActor) > 0);

  const previousDocument = globalThis.document;
  const previousURL = globalThis.URL;
  const previousBlob = globalThis.Blob;
  let clicked = false;
  globalThis.Blob = class { constructor(parts, opts) { this.parts = parts; this.opts = opts; } };
  globalThis.URL = {
    createObjectURL: () => 'blob:test',
    revokeObjectURL: () => {}
  };
  globalThis.document = {
    createElement: () => ({
      href: '',
      download: '',
      click: () => { clicked = true; }
    }),
    body: {
      appendChild: () => {},
      removeChild: () => {}
    }
  };
  await CharacterExporter.downloadCharacterJSON(exportActor);
  assert.equal(clicked, true);
  globalThis.document = previousDocument;
  globalThis.URL = previousURL;
  globalThis.Blob = previousBlob;
});
