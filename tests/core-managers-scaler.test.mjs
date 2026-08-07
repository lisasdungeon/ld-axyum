import assert from 'node:assert/strict';
import test from 'node:test';

test('ability score manager covers roll budget, assignment, and validation', async () => {
  const { AbilityScoreManager } = await import('../core/ability-score-manager.js');
  const mgr = new AbilityScoreManager();
  assert.equal(mgr.hasRolled, false);
  assert.equal(mgr.canRoll(), true);
  assert.equal(mgr.rollSingleAbility(null).ok, false);
  assert.equal(mgr.rollSingleAbility('str').ok, true);
  assert.equal(mgr.rollSingleAbility('str').reason, 'use-reroll-all');
  for (const key of ['dex', 'con', 'int', 'wis', 'cha']) {
    assert.equal(mgr.rollSingleAbility(key).ok, true);
  }
  assert.equal(mgr.hasRolledOnce(), true);
  assert.equal(mgr.canReroll(), true);
  assert.equal(mgr.rollSingleAbility('str').reason, 'use-reroll-all');
  const all = mgr.rollAllAbilityScores();
  assert.equal(all.ok, true);
  assert.equal(mgr.hasRerolled, true);
  assert.equal(mgr.rollAllAbilityScores().ok, false);
  assert.equal(mgr.rollPoolScores().ok, false);
  assert.equal(mgr.rollSingleAbility('str').reason, 'limit');

  const mgr2 = new AbilityScoreManager();
  const pool = mgr2.rollPoolScores(6);
  assert.equal(pool.ok, true);
  assert.equal(pool.pool.length, 6);
  mgr2.assignScore('str', pool.pool[0].value);
  assert.equal(mgr2.getAssignedScore('str'), pool.pool[0].value);
  assert.equal(mgr2.isScoreAssigned(pool.pool[0].value), true);
  mgr2.rolledPool[0].assigned = true;
  assert.ok(Array.isArray(mgr2.getUnassignedScores()));
  mgr2.clearAssignments();
  assert.equal(mgr2.getAssignedScore('str'), null);
  assert.equal(mgr2.validateStandardArray({ str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 }), true);
  assert.equal(mgr2.validateStandardArray({ str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 9 }), false);
  assert.equal(mgr2.validatePointBuy({ str: 15, dex: 15, con: 15, int: 8, wis: 8, cha: 8 }), true);
  assert.equal(mgr2.validatePointBuy({ str: 16, dex: 8, con: 8, int: 8, wis: 8, cha: 8 }), false);
  assert.equal(mgr2.calculateModifier(16), 3);
  assert.deepEqual(mgr2.getAbilityModifiers({ str: 16 }), { str: 3 });
  assert.deepEqual(mgr2.getStandardArrayScores().options, [15, 14, 13, 12, 10, 8]);
  assert.equal(mgr2.getPointBuyRules().pointsTotal, 27);
  assert.ok(mgr2.getRolledScores());
  assert.ok(mgr2.getDiceBreakdowns());
  assert.ok(mgr2.getAssignedAbilities());
  assert.ok(mgr2.getRolledPool());
  mgr2.resetKeepRerollBudget();
  assert.equal(mgr2.fullSetsCompleted, 1);
  mgr2.reset();
  assert.equal(mgr2.fullSetsCompleted, 1);
  assert.ok(mgr2.getRerollStatus().label);
});

test('level scaler covers HP, proficiency, ASI, spell slots, and features', async () => {
  const LevelScalerModule = await import('../core/level-scaler.js');
  const LevelScaler = LevelScalerModule.default || LevelScalerModule.LevelScaler;
  const scaler = new LevelScaler();
  assert.equal(scaler.calculateHP(0, 'fighter'), 0);
  assert.equal(scaler.calculateHP(21, 'fighter'), 0);
  assert.ok(scaler.calculateHP(1, 'barbarian', 2) >= 1);
  assert.ok(scaler.calculateHP(5, 'wizard', 1) > scaler.calculateHP(1, 'wizard', 1));
  assert.ok(scaler.calculateHP(3, 'unknown', 0) >= 1);
  assert.equal(scaler.calculateProficiency(0), 0);
  assert.equal(scaler.calculateProficiency(1), 2);
  assert.equal(scaler.calculateProficiency(5), 3);
  assert.equal(scaler.calculateProficiency(9), 4);
  assert.equal(scaler.calculateProficiency(13), 5);
  assert.equal(scaler.calculateProficiency(17), 6);
  assert.ok(scaler.getASILevels(8).includes(4));
  assert.equal(scaler.hasASIAtLevel(4), true);
  assert.equal(scaler.hasASIAtLevel(5), false);
  assert.ok(scaler.calculateSpellSlots(5, 'wizard'));
  assert.ok(scaler.calculateSpellSlots(5, 'paladin'));
  assert.ok(scaler.calculateSpellSlots(5, 'fighter'));
  assert.ok(scaler.calculateSpellSlots(11, 'warlock'));
  assert.ok(scaler.calculateSpellSlots(17, 'warlock'));
  assert.ok(scaler.calculateSpellSlots(3, 'warlock'));
  assert.ok(scaler.calculateSpellSlots(0, 'warlock'));
  assert.ok(scaler.calculateSpellSlots(99, 'wizard') === null || typeof scaler.calculateSpellSlots(99, 'wizard') === 'object');
  assert.ok(scaler.getClassFeaturesAtLevel(1, 'fighter'));
  assert.ok(scaler.getClassFeaturesAtLevel(5, 'wizard'));
  assert.ok(scaler.getClassFeaturesAtLevel(3, 'unknown'));
  const summary = scaler.getSummary(5, 'wizard', 2);
  assert.ok(summary.hp);
  assert.ok(summary.proficiency);
});

test('homebrew loader detects packs and loads content', async () => {
  const { HomebrewLoader } = await import('../core/homebrew-loader.js');
  assert.deepEqual(HomebrewLoader.detectHomebrewPacks(), []);
  assert.equal(HomebrewLoader.extractModuleSource(null), 'Unknown');
  assert.equal(HomebrewLoader.extractModuleSource('my-mod.classes'), 'My Mod');
  assert.equal(HomebrewLoader.extractModuleSource('simple'), 'Simple');

  const index = [
    { _id: 'c1', name: 'Custom Class', type: 'class' },
    { _id: 'r1', name: 'Custom Race', type: 'race' },
    { _id: 's1', name: 'Custom Spell', type: 'spell' },
    { _id: 'f1', name: 'Custom Feat', type: 'feat' },
    { _id: 'e1', name: 'Custom Item', type: 'equipment' },
    { _id: 'w1', name: 'Custom Weapon', type: 'weapon' }
  ];
  const packs = new Map([
    ['dnd5e.classes', { collection: 'dnd5e.classes', index: [{ _id: 'x' }], metadata: { label: 'SRD', type: 'Item' } }],
    ['my-homebrew.items', {
      collection: 'my-homebrew.items',
      index,
      metadata: { label: 'Homebrew', type: 'Item' },
      getIndex: async () => index,
      getDocument: async (id) => ({
        id,
        name: index.find((i) => i._id === id)?.name,
        type: index.find((i) => i._id === id)?.type,
        system: {},
        toObject: () => ({ name: 'x', type: 'class', system: {} })
      })
    }],
    ['empty.pack', { collection: 'empty.pack', index: [], metadata: {} }]
  ]);
  globalThis.game = {
    packs: {
      values: () => packs.values(),
      get: (name) => packs.get(name)
    }
  };
  const detected = HomebrewLoader.detectHomebrewPacks();
  assert.ok(detected.some((p) => p.name === 'my-homebrew.items'));

  const loader = new HomebrewLoader();
  const content = await loader.loadHomebrewContent();
  assert.equal(content.detected, true);
  assert.ok(Array.isArray(content.classes));

  const emptyLoader = new HomebrewLoader();
  globalThis.game.packs = { values: () => [].values(), get: () => null };
  const empty = await emptyLoader.loadHomebrewContent();
  assert.equal(empty.detected, false);

  // detect throws
  globalThis.game.packs = {
    values: () => { throw new Error('packs boom'); }
  };
  assert.deepEqual(HomebrewLoader.detectHomebrewPacks(), []);

  const validation = loader.validateHomebrewContent({
    classes: [{ name: 'C', hitDice: 'd8' }, { name: '' }],
    races: [{ name: 'R' }, {}],
    spells: [{ name: 'S', level: 1 }, { name: 'Bad' }],
    feats: [{ name: 'F' }, {}]
  });
  assert.equal(validation.valid, false);
  assert.ok(validation.errors.length > 0);
  assert.equal(loader.validateHomebrewContent({
    classes: [{ name: 'C', hitDice: 'd8' }],
    races: [{ name: 'R' }],
    spells: [{ name: 'S', level: 0 }],
    feats: [{ name: 'F' }]
  }).valid, true);

  const merged = loader.mergeHomebrewContent(
    {
      classes: [{ name: 'Fighter', isHomebrew: false }],
      races: [],
      spells: [],
      feats: [],
      equipment: []
    },
    {
      classes: [{ name: 'Custom', isHomebrew: true }, { name: 'Fighter', isHomebrew: true }],
      races: [{ name: 'Race', isHomebrew: true }],
      spells: [],
      feats: [],
      equipment: []
    }
  );
  assert.equal(merged.classes.filter((c) => c.name === 'Fighter').length, 1);
  assert.ok(merged.classes.some((c) => c.name === 'Custom'));
  assert.ok(merged.races.some((r) => r.name === 'Race'));

  // pack load failure path
  globalThis.game.packs = {
    values: () => packs.values(),
    get: () => ({
      getIndex: async () => { throw new Error('index fail'); }
    })
  };
  const failed = await loader.loadHomebrewFromPack('my-homebrew.items');
  assert.deepEqual(failed.classes, []);
});

