import assert from 'node:assert/strict';
import test from 'node:test';

test('multiclass calculator empty/null guards and validation detail branches', async () => {
  const MulticlassCalculator = (await import('../core/multiclass-calculator.js')).default;
  assert.equal(MulticlassCalculator.getMulticlassHP(null, 1, () => 8), 1);
  assert.equal(MulticlassCalculator.getMulticlassHP([], 1, () => 8), 1);
  assert.equal(MulticlassCalculator.getMulticlassProficiencyBonus(null, () => 2), 2);
  assert.equal(MulticlassCalculator.isMulticlassSpellcaster(null, () => true), false);
  assert.deepEqual(MulticlassCalculator.getMulticlassFeatures(null), {});
  assert.equal(MulticlassCalculator.validateMulticlassLevels([{ name: 'A', level: 1 }]).valid, false);
  assert.equal(MulticlassCalculator.validateMulticlassLevels([{ id: 'a', name: 'A', level: 0 }]).valid, false);
  assert.equal(MulticlassCalculator.validateMulticlassLevels([{ id: 'a', name: 'A', level: 1.5 }]).valid, false);
});

test('rules engine thin wrappers and half-caster slots', async () => {
  const { RulesEngine } = await import('../core/rules-engine.js');
  assert.ok(RulesEngine.getSpellSlots('paladin', 5));
  assert.ok(RulesEngine.getSpellSlots('ranger', 20));
  assert.equal(RulesEngine.getSpellSlots(null, 1), null);
  assert.equal(RulesEngine.getSpellSlots('fighter', 5), null);
  assert.equal(RulesEngine.validateMulticlassLevels([{ id: 'a', name: 'A', level: 1 }]).valid, true);
  assert.equal(RulesEngine._getHitDie('fighter'), 10);
  assert.deepEqual(RulesEngine.getASILevels('fighter'), [4, 8, 12, 16, 19]);
  assert.equal(RulesEngine.hasASIAtLevel('wizard', 4), true);
  assert.equal(RulesEngine.countASIsByLevel(8), 2);
  assert.equal(RulesEngine.validateFeatSelection({ featName: 'Alert' }).valid, true);
  assert.ok(RulesEngine.getAvailableFeats(4));
  assert.equal(RulesEngine.canChooseASI('rogue', 4), true);
  assert.deepEqual(RulesEngine.applyFeat('Tough', {}).feats, ['Tough']);
  assert.deepEqual(RulesEngine.removeFeat('Tough', { feats: ['Tough'] }).feats, []);
  assert.equal(RulesEngine.calculateSkillBonus({
    abilityModifier: 2, proficient: true, expertise: false, proficiencyBonus: 2
  }), 4);
  assert.equal(RulesEngine.calculatePassiveScore(5), 15);
  const character = {
    abilities: { str: 10, dex: 14, con: 12, int: 16, wis: 10, cha: 8 },
    skills: { arcana: { proficient: true } },
    savingThrows: { int: { proficient: true } },
    class: { name: 'Wizard', level: 5 },
    skillProficiencies: ['arcana']
  };
  assert.ok(RulesEngine.calculateAllSkills(character));
  assert.ok(RulesEngine.calculateSavingThrows(character));
  assert.equal(RulesEngine.calculateSpellSaveDC({ abilityModifier: 3, proficiencyBonus: 3 }), 14);
  assert.equal(RulesEngine.calculateSpellAttackBonus({ abilityModifier: 3, proficiencyBonus: 3 }), 6);
  assert.equal(RulesEngine.calculateCarryingCapacity(10), 150);
  assert.ok(RulesEngine.checkEncumbrance(10, 10));
  assert.ok(Array.isArray(RulesEngine.getAbilityScoresArray(character.abilities)));
  assert.ok(RulesEngine.getMulticlassFeatures([{ name: 'Fighter', level: 1 }]).Fighter);
});

test('spell management third casters, empty paths, and error catches', async () => {
  const { SpellManagement } = await import('../core/spell-management.js');
  globalThis.ui = { notifications: { warn: () => {}, notify: () => {}, error: () => {} } };

  const third = SpellManagement.calculateSpellSlots({
    classes: [
      { classId: 'fighter-eldritch-knight', level: 9 },
      { classId: 'rogue-arcane-trickster', level: 6 },
      { classId: 'fighter', level: 2 }
    ]
  });
  assert.ok(third[1] >= 0);
  assert.deepEqual(SpellManagement.getPreparedSpellLimit({ classes: [] }), {});
  assert.deepEqual(SpellManagement.getPreparedSpellLimit({
    classes: [{ classId: 'druid', level: 3 }],
    abilities: { wis: 14 }
  }).druid, 5);
  assert.deepEqual(SpellManagement.getPreparedSpellLimit({
    classes: [{ classId: 'paladin', level: 5 }],
    abilities: { cha: 8 }
  }).paladin, 1);
  assert.deepEqual(SpellManagement.getPreparedSpellLimit({
    classes: [{ classId: 'bard', level: 5 }],
    abilities: { cha: 16 }
  }).bard, null);

  assert.deepEqual(SpellManagement.getAvailableSpellsForPreparation({}, {}), {
    prepared: [], available: []
  });
  const prepActor = {
    items: [
      { type: 'loot', id: 'l1' },
      { type: 'spell', id: 's1', name: 'P', system: { level: 1, preparation: { prepared: true } } },
      { type: 'spell', id: 's2', name: 'A', system: { level: 1, preparation: { prepared: false } } }
    ]
  };
  const prep = SpellManagement.getAvailableSpellsForPreparation(prepActor, {});
  assert.equal(prep.prepared.length, 1);
  assert.equal(prep.available.length, 1);

  const boomActor = {
    getFlag: () => { throw new Error('flag'); },
    setFlag: async () => { throw new Error('set'); },
    items: { get: () => { throw new Error('get'); } }
  };
  assert.equal(await SpellManagement.updateSpellSlotsOnRest(boomActor, 'long'), null);
  assert.equal(await SpellManagement.initializeSpellSlots(boomActor, { classes: [] }), null);
  assert.equal(await SpellManagement.consumeSpellSlot(boomActor, 1), false);
  assert.equal(await SpellManagement.recoverSpellSlot(boomActor, 1), false);
  assert.equal(await SpellManagement.toggleSpellPrepared(boomActor, 's1', true), false);

  const flags = {};
  const okActor = {
    getFlag: (_m, k) => flags[k],
    setFlag: async (_m, k, v) => { flags[k] = v; },
    items: {
      get: (id) => (id === 'missing' ? null : { type: 'loot', update: async () => {} })
    }
  };
  flags.spellSlots = {
    1: { max: 2, current: 1 },
    warlock: { slots: 2, current: 0 },
    cantrips: { max: 0, current: 0 }
  };
  await SpellManagement.updateSpellSlotsOnRest(okActor, 'long');
  assert.equal(flags.spellSlots[1].current, 2);
  assert.equal(flags.spellSlots.warlock.current, 2);
  flags.spellSlots.warlock.current = 0;
  await SpellManagement.updateSpellSlotsOnRest(okActor, 'short');
  assert.equal(flags.spellSlots.warlock.current, 2);
  assert.equal(await SpellManagement.consumeSpellSlot(okActor, 9), false);
  flags.spellSlots[1].current = 2;
  assert.equal(await SpellManagement.consumeSpellSlot(okActor, 1), true);
  flags.spellSlots[1].current = 2;
  assert.equal(await SpellManagement.recoverSpellSlot(okActor, 1), false);
  flags.spellSlots[1].current = 0;
  assert.equal(await SpellManagement.recoverSpellSlot(okActor, 1), true);
  assert.equal(await SpellManagement.toggleSpellPrepared(okActor, 'missing', false), false);
  assert.equal(await SpellManagement.toggleSpellPrepared(okActor, 's1', false), false);

  await SpellManagement.initializeSpellSlots(okActor, {
    classes: [{ classId: 'wizard', level: 5 }, { classId: 'warlock', level: 3 }]
  });
  assert.ok(flags.spellSlots);
  assert.ok(flags.spellSlots.warlock);
});

test('content loader/transformers/cache/homebrew remaining branches', async () => {
  const {
    ContentLoader,
    extractSource,
    sourceRank
  } = await import('../core/content-loader.js').then(async (mod) => {
    // sourceRank may be unexported; exercise via itemPriority unknown
    return mod;
  });
  const transformers = await import('../core/content-transformers.js');

  // formatSkillList non-array non-object
  const bgWeird = transformers.BackgroundTransformer.transform({
    id: 'b', name: 'Weird',
    system: { skills: 42 }
  }, 'world');
  assert.deepEqual(bgWeird.skills, []);

  // formatSaves non-array non-object
  const clsWeird = transformers.ClassTransformer.transform({
    id: 'c', name: 'Odd',
    system: { saves: 7, primaryAbility: null }
  }, 'world');
  assert.ok(Array.isArray(clsWeird.saves) || clsWeird.savesLabel !== undefined);

  // size array path already hit; force sizeFromAdvancement empty + traits path
  const raceArr = transformers.RaceTransformer.transform({
    id: 'r', name: 'Big',
    system: {
      traits: { size: ['lg', 'huge'], senses: { darkvision: 'far' } },
      movement: { walk: 30 }
    }
  }, 'world');
  assert.match(String(raceArr.sizeLabel), /Large|Huge|Gargantuan|lg|huge/i);

  // extractSource custom path already; ensure unknown source rank path via itemPriority
  const { itemPriority } = await import('../core/content-loader.js');
  assert.ok(itemPriority({ source: 'TotallyCustomBookXYZ', packName: 'zzz.pack' }) >= 0);

  const loader = new ContentLoader();
  globalThis.game = {
    items: [],
    packs: [{
      collection: 'bad.pack',
      documentName: 'Item',
      metadata: {},
      getIndex: async () => { throw new Error('nope'); }
    }]
  };
  const items = await loader.loadItemType('feat', ['bad.pack']);
  assert.ok(Array.isArray(items));

  // getOrLoad catch deletes inflight and rethrows when loadItemType rejects
  const original = loader.loadItemType.bind(loader);
  loader.loadItemType = async () => { throw new Error('boom'); };
  await assert.rejects(() => loader.getOrLoad('weapon', ['x']), /boom/);
  loader.loadItemType = original;

  const CompendiumCacheManager = (await import('../core/compendium-cache-manager.js')).default;
  globalThis.game = {
    settings: { get: () => [] },
    packs: [
      { collection: 'dnd5e.classes', documentName: 'Item', metadata: { type: 'Item' } },
      { collection: 'dnd5e.actors', documentName: 'Actor', metadata: { type: 'Actor' } },
      { collection: 'weird.pack', documentName: '', metadata: {} }
    ]
  };
  // Array.from(game.packs) — packs is array-like
  globalThis.game.packs[Symbol.iterator] = function* () {
    yield* [
      { collection: 'dnd5e.classes', documentName: 'Item', metadata: { type: 'Item' } },
      { collection: 'dnd5e.actors', documentName: 'Actor', metadata: { type: 'Actor' } },
      { collection: 'weird.pack', documentName: '', metadata: {} }
    ];
  };
  const contentLoader = {
    loadItemType: async () => [{ name: 'X', source: 'PHB', packName: 'dnd5e.classes' }]
  };
  const t = {
    ClassTransformer: { transform: (d) => d },
    RaceTransformer: { transform: (d) => d },
    BackgroundTransformer: { transform: (d) => d },
    SpellTransformer: { transform: (d) => d },
    FeatTransformer: { transform: (d) => d },
    EquipmentTransformer: { transform: (d) => d }
  };
  const loaded = await CompendiumCacheManager.performLoad(contentLoader, {}, t);
  assert.ok(loaded.classes);

  const { HomebrewLoader } = await import('../core/homebrew-loader.js');
  const hb = new HomebrewLoader();
  // loadHomebrewContent catch: detect ok then pack load throws outside try of fromPack
  globalThis.game = {
    packs: {
      values: () => [{
        collection: 'my-mod.items',
        index: [{ _id: '1', name: 'X', type: 'class' }],
        metadata: { label: 'M', type: 'Item' }
      }].values(),
      get: () => ({
        getIndex: async () => { throw new Error('index'); },
        getDocument: async () => null
      })
    }
  };
  // Make detectHomebrewPacks throw mid-load by replacing after first call
  const origDetect = HomebrewLoader.detectHomebrewPacks;
  let calls = 0;
  HomebrewLoader.detectHomebrewPacks = () => {
    calls += 1;
    if (calls === 1) return [{ name: 'my-mod.items' }];
    throw new Error('detect mid');
  };
  // loadHomebrewContent uses detect once at start; force throw inside for-loop
  hb.loadHomebrewFromPack = async () => { throw new Error('pack loop'); };
  const failedLoad = await hb.loadHomebrewContent();
  assert.equal(failedLoad.detected, false);
  HomebrewLoader.detectHomebrewPacks = origDetect;

  // merge catch
  const badOfficial = {
    get classes() { throw new Error('merge boom'); }
  };
  assert.equal(hb.mergeHomebrewContent(badOfficial, { classes: [] }), badOfficial);

  // _mergeAndDedup sortBySource false path via direct call
  const merged = hb._mergeAndDedup(
    [{ name: 'B', isHomebrew: false }, { name: 'A', isHomebrew: true }],
    [{ name: 'C', isHomebrew: true }],
    'name',
    false
  );
  assert.deepEqual(merged.map((i) => i.name), ['A', 'B', 'C']);
  const merged2 = hb._mergeAndDedup(
    [{ name: 'Z', isHomebrew: false }],
    [{ name: 'A', isHomebrew: true }],
    'name',
    true
  );
  assert.equal(merged2[0].isHomebrew, false);
  // same isHomebrew forces name localeCompare branch under sortBySource
  const sameHb = hb._mergeAndDedup(
    [{ name: 'Zebra', isHomebrew: true }],
    [{ name: 'Apple', isHomebrew: true }],
    'name',
    true
  );
  assert.deepEqual(sameHb.map((i) => i.name), ['Apple', 'Zebra']);
  void extractSource;
  void sourceRank;
});

test('multipath forceRender raises z-index for real HTMLElement', async () => {
  const multipath = await import('../core/multipath.js');
  globalThis.HTMLElement = class HTMLElement {};
  const el = Object.assign(Object.create(HTMLElement.prototype), {
    style: { zIndex: '' }
  });
  const app = {
    element: el,
    bringToFront: () => { app.front = true; },
    render: async () => app
  };
  const other = { style: {} };
  globalThis.document = {
    querySelectorAll: () => [other]
  };
  globalThis.window = {
    getComputedStyle: (node) => ({ zIndex: node === other ? '200' : '1' })
  };
  await multipath.forceRender(app);
  await new Promise((resolve) => queueMicrotask(resolve));
  await new Promise((resolve) => queueMicrotask(resolve));
  assert.equal(el.style.zIndex, '201');
  assert.equal(app.front, true);
});
