import assert from 'node:assert/strict';
import test from 'node:test';

test('logger routes debug and always emits warn/error', async () => {
  const { logger } = await import('../core/logger.js');
  const previousGame = globalThis.game;
  const logs = [];
  const debugs = [];
  const warns = [];
  const errors = [];
  const previous = {
    log: console.log,
    debug: console.debug,
    warn: console.warn,
    error: console.error
  };
  console.log = (...args) => logs.push(args);
  console.debug = (...args) => debugs.push(args);
  console.warn = (...args) => warns.push(args);
  console.error = (...args) => errors.push(args);

  globalThis.game = { settings: { get: () => false } };
  logger.log('quiet');
  logger.debug('quiet');
  assert.equal(logs.length, 0);
  assert.equal(debugs.length, 0);

  globalThis.game = { settings: { get: () => true } };
  logger.log('a');
  logger.debug('b');
  assert.equal(logs.length, 1);
  assert.equal(debugs.length, 1);

  globalThis.game = {
    settings: {
      get: () => { throw new Error('settings missing'); }
    }
  };
  logger.log('still quiet');
  assert.equal(logs.length, 1);

  logger.warn('w');
  logger.error('e');
  assert.equal(warns.length, 1);
  assert.equal(errors.length, 1);

  console.log = previous.log;
  console.debug = previous.debug;
  console.warn = previous.warn;
  console.error = previous.error;
  globalThis.game = previousGame;
});

test('ability score utils and calculator cover modifiers, generation, and proficiency', async () => {
  const { AbilityScoreUtils } = await import('../core/ability-score-utils.js');
  const { AbilityCalculator } = await import('../core/ability-calculator.js');

  assert.equal(AbilityScoreUtils.getAbilityModifier(10), 0);
  assert.equal(AbilityScoreUtils.getAbilityModifier(18), 4);
  assert.equal(AbilityScoreUtils.getAbilityModifier(8), -1);
  assert.deepEqual(AbilityScoreUtils.getAbilityModifiers({
    str: 16, dex: 14, con: 12, int: 10, wis: 8, cha: 20
  }), { str: 3, dex: 2, con: 1, int: 0, wis: -1, cha: 5 });

  assert.deepEqual(AbilityScoreUtils.generateAbilityScores('standard'), {
    str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8
  });
  assert.deepEqual(AbilityScoreUtils.generateAbilityScores('pointbuy'), {
    str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8
  });
  const rolled = AbilityScoreUtils.generateAbilityScores('roll');
  for (const score of Object.values(rolled)) {
    assert.ok(score >= 3 && score <= 18);
  }
  assert.deepEqual(AbilityScoreUtils.generateAbilityScores('unknown'), {
    str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10
  });
  assert.deepEqual(AbilityScoreUtils.generateAbilityScores(), {
    str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8
  });

  assert.equal(AbilityCalculator.getAbilityModifier(15), 2);
  assert.deepEqual(AbilityCalculator.getAbilityModifiers(null), {
    str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0
  });
  assert.deepEqual(AbilityCalculator.getAbilityModifiers({ str: 14 }), {
    str: 2, dex: 0, con: 0, int: 0, wis: 0, cha: 0
  });
  assert.equal(AbilityCalculator.getProficiencyBonus(1), 2);
  assert.equal(AbilityCalculator.getProficiencyBonus(5), 3);
  assert.equal(AbilityCalculator.getProficiencyBonus(9), 4);
  assert.equal(AbilityCalculator.getProficiencyBonus(13), 5);
  assert.equal(AbilityCalculator.getProficiencyBonus(17), 6);
  assert.equal(AbilityCalculator.getProficiencyBonus(0), 2);
  assert.equal(AbilityCalculator.getProficiencyBonus(99), 2);
});

test('combat calculator covers hit points and armor class branches', async () => {
  const CombatCalculator = (await import('../core/combat-calculator.js')).default;
  assert.equal(CombatCalculator.getHitDie('Barbarian'), 12);
  assert.equal(CombatCalculator.getHitDie('wizard'), 6);
  assert.equal(CombatCalculator.getHitDie(null), 8);
  assert.equal(CombatCalculator.getHitDie('unknown'), 8);

  const fighter1 = CombatCalculator.calculateHitPoints({
    className: 'Fighter', level: 1, conModifier: 2, useMaxAtFirst: true
  });
  assert.equal(fighter1, 12);
  const wizard3 = CombatCalculator.calculateHitPoints({
    className: 'Wizard', level: 3, conModifier: 1, useMaxAtFirst: false
  });
  assert.ok(wizard3 >= 1);
  assert.equal(CombatCalculator.calculateHitPoints({
    className: 'Wizard', level: 1, conModifier: -5, useMaxAtFirst: true
  }), 1);

  assert.equal(CombatCalculator.calculateArmorClass({
    armorType: 'light', armorAC: 12, dexModifier: 3, shieldBonus: 2, acBonus: 1
  }), 18);
  assert.equal(CombatCalculator.calculateArmorClass({
    armorType: 'medium', armorAC: 14, dexModifier: 4
  }), 16);
  assert.equal(CombatCalculator.calculateArmorClass({
    armorType: 'heavy', armorAC: 18, dexModifier: 4
  }), 18);
  assert.equal(CombatCalculator.calculateArmorClass({
    armorType: 'none', dexModifier: 2
  }), 12);
  assert.equal(CombatCalculator.calculateArmorClass({
    armorType: null, armorAC: 0, dexModifier: 1
  }), 11);
});

test('feat calculator validates and mutates feats', async () => {
  const FeatCalculator = (await import('../core/feat-calculator.js')).default;
  assert.deepEqual(FeatCalculator.getASILevels('fighter'), [4, 8, 12, 16, 19]);
  assert.equal(FeatCalculator.hasASIAtLevel('wizard', 4), true);
  assert.equal(FeatCalculator.hasASIAtLevel('wizard', 5), false);
  assert.equal(FeatCalculator.countASIsByLevel(8), 2);
  assert.equal(FeatCalculator.countASIsByLevel(3), 0);
  assert.deepEqual(FeatCalculator.validateFeatSelection({}), {
    valid: false, message: 'Feat name required'
  });
  assert.deepEqual(FeatCalculator.validateFeatSelection({
    featName: 'Alert', selectedFeats: ['Alert']
  }), { valid: false, message: 'Alert already selected' });
  assert.equal(FeatCalculator.validateFeatSelection({ featName: 'Alert' }).valid, true);
  assert.equal(FeatCalculator.getAvailableFeats(8).asiCount, 2);
  assert.equal(FeatCalculator.canChooseASI('rogue', 4), true);
  const withFeat = FeatCalculator.applyFeat('Tough', {});
  assert.deepEqual(withFeat.feats, ['Tough']);
  FeatCalculator.applyFeat('Alert', withFeat);
  assert.deepEqual(FeatCalculator.removeFeat('Tough', withFeat).feats, ['Alert']);
  assert.deepEqual(FeatCalculator.removeFeat('x', {}), {});
});

test('spellcasting calculator covers full/half casters and cantrips', async () => {
  const SpellcastingCalculator = (await import('../core/spellcasting-calculator.js')).default;
  assert.equal(SpellcastingCalculator.getSpellSlots(null, 1), null);
  assert.equal(SpellcastingCalculator.getSpellSlots('fighter', 5), null);
  assert.equal(SpellcastingCalculator.getSpellSlots('Wizard', 1).type, 'full');
  assert.deepEqual(SpellcastingCalculator.getSpellSlots('wizard', 1).slots.slice(0, 2), [2, 0]);
  assert.equal(SpellcastingCalculator.getSpellSlots('wizard', 99).slots[0], 4);
  assert.equal(SpellcastingCalculator.getSpellSlots('Paladin', 2).type, 'half');
  assert.equal(SpellcastingCalculator.getSpellSlots('ranger', 99).slots[0], 4);
  assert.equal(SpellcastingCalculator.isSpellcaster(null), false);
  assert.equal(SpellcastingCalculator.isSpellcaster('Warlock'), true);
  assert.equal(SpellcastingCalculator.isSpellcaster('Fighter'), false);
  assert.equal(SpellcastingCalculator.getCantripCount(null, 1), 0);
  assert.equal(SpellcastingCalculator.getCantripCount('fighter', 5), 0);
  assert.equal(SpellcastingCalculator.getCantripCount('wizard', 1), 3);
  assert.equal(SpellcastingCalculator.getCantripCount('wizard', 10), 5);
  assert.equal(SpellcastingCalculator.getCantripCount('artificer', 14), 4);
});

test('wizard navigation walks pages and labels', async () => {
  const { WizardNavigation } = await import('../core/wizard-navigation.js');
  const nav = new WizardNavigation();
  assert.equal(nav.getCurrentPage(), 'welcome');
  assert.equal(nav.getCurrentPageIndex(), 0);
  assert.equal(nav.getTotalPages(), 15);
  assert.equal(nav.isFirstPage(), true);
  assert.equal(nav.isLastPage(), false);
  assert.equal(nav.canNavigatePrevious(), false);
  assert.equal(nav.previousPage(), false);
  assert.equal(nav.nextPage(), true);
  assert.equal(nav.getCurrentPage(), 'role');
  assert.equal(nav.goToPage('summary'), true);
  assert.equal(nav.isLastPage(), true);
  assert.equal(nav.canNavigateNext(), false);
  assert.equal(nav.nextPage(), false);
  assert.equal(nav.goToPage(0), true);
  assert.equal(nav.goToPage(-1), false);
  assert.equal(nav.goToPage(99), false);
  assert.equal(nav.goToPage('missing'), false);
  assert.equal(nav.getPageLabel('welcome'), 'Welcome');
  assert.equal(nav.getPageLabel('custom'), 'custom');
  assert.equal(nav.getSteps().length, 15);
  const custom = new WizardNavigation(['a', 'b']);
  assert.equal(custom.getTotalPages(), 2);
});

test('multiclass utils validate, migrate, and summarize levels', async () => {
  const { MulticlassUtils } = await import('../core/multiclass-utils.js');
  assert.equal(MulticlassUtils.validateMulticlass({}).valid, false);
  assert.equal(MulticlassUtils.validateMulticlass({ classes: [] }).valid, false);
  assert.equal(MulticlassUtils.validateMulticlass({
    classes: [{ id: 'a', name: 'A', level: 12 }, { id: 'b', name: 'B', level: 12 }]
  }).valid, false);
  assert.equal(MulticlassUtils.validateMulticlass({
    classes: [{ id: null, name: null, level: 0 }]
  }).errors.length >= 2, true);
  assert.equal(MulticlassUtils.validateMulticlass({
    classes: [
      { id: 'fighter', name: 'Fighter', level: 2 },
      { id: 'fighter', name: 'Fighter', level: 1 }
    ]
  }).valid, false);
  assert.equal(MulticlassUtils.validateMulticlass({
    classes: [{ id: 'wizard', name: 'Wizard', level: 5 }]
  }).valid, true);

  assert.equal(MulticlassUtils.migrateToMulticlass(null).class.level, 1);
  const already = { classes: [{ id: 'x', name: 'X', level: 2 }] };
  assert.equal(MulticlassUtils.migrateToMulticlass(already), already);
  const phase2 = MulticlassUtils.migrateToMulticlass({
    class: { id: 'fighter', name: 'Fighter', subclass: 'Champion', level: 3 }
  });
  assert.equal(phase2.classes[0].name, 'Fighter');
  assert.equal(phase2.feats.length, 0);
  const fallback = MulticlassUtils.migrateToMulticlass({ name: 'orphan' });
  assert.equal(fallback.classes[0].name, 'Wizard');

  assert.equal(MulticlassUtils.getTotalLevel(null), 1);
  assert.equal(MulticlassUtils.getTotalLevel({ classes: [{ level: 3 }, { level: 2 }] }), 5);
  assert.equal(MulticlassUtils.getPrimaryClass(null), null);
  assert.equal(MulticlassUtils.getPrimaryClass({ classes: [] }), null);
  assert.equal(MulticlassUtils.getPrimaryClass({ classes: [{ name: 'Rogue' }] }).name, 'Rogue');
});

test('static data maps and character defaults export expected keys', async () => {
  const staticData = await import('../core/axyum-static-data.js');
  assert.equal(staticData.STANDARD_LANGUAGES.length, 8);
  assert.equal(staticData.EXOTIC_LANGUAGES.length, 8);
  assert.equal(staticData.ALL_LANGUAGES.length, 16);
  assert.ok(staticData.RACE_LANGUAGE_MAP.elf.includes('elvish'));
  assert.ok(staticData.CLASS_ARMOR_MAP.fighter.includes('hvy'));
  assert.ok(staticData.CLASS_WEAPON_MAP.rogue.includes('rapier'));
  assert.ok(staticData.BACKGROUND_TOOL_MAP.criminal.includes('thievesTools'));
  assert.equal(staticData.SKILL_DEFINITIONS.length, 18);
  assert.equal(staticData.CLASS_SKILL_MAP.Wizard.count, 2);
  assert.equal(staticData.ABILITY_DEFINITIONS.length, 6);
  assert.equal(staticData.TRAIT_TABLE_MAP['details.flaws'], 'flaws');

  const { CHARACTER_DEFAULTS } = await import('../core/character-defaults.js');
  assert.equal(CHARACTER_DEFAULTS.class.level, 1);
  assert.equal(CHARACTER_DEFAULTS.abilities.str, 10);
  assert.equal(CHARACTER_DEFAULTS.skills.stealth.proficient, false);

  const { CLASS_CARD_IMAGES } = await import('../core/class-card-images.js');
  const { ROLE_CARD_IMAGES } = await import('../core/role-card-images.js');
  assert.ok(CLASS_CARD_IMAGES.Wizard);
  assert.ok(ROLE_CARD_IMAGES.Tank);
});

test('starting equipment resolves packages and choices', async () => {
  const {
    resolveEquipmentEntry,
    buildStartingPackages,
    resolveSelectedPackageItems
  } = await import('../core/starting-equipment.js');

  assert.equal(resolveEquipmentEntry({}).id, '');
  const fromCache = resolveEquipmentEntry(
    { key: 'Compendium.phb.phbwepGreataxe00', count: 2, requiresProficiency: true },
    [{ id: 'phbwepGreataxe00', name: 'Greataxe', type: 'weapon', price: 30, rarity: 'common', weight: 7, description: 'big axe', img: 'x.png' }]
  );
  assert.equal(fromCache.name, 'Greataxe');
  assert.equal(fromCache.count, 2);
  assert.equal(fromCache.requiresProficiency, true);

  assert.deepEqual(buildStartingPackages(null), { packages: [], mode: 'empty' });
  assert.deepEqual(buildStartingPackages([]), { packages: [], mode: 'empty' });

  const dualPackage = buildStartingPackages([
    { type: 'OR', _id: 'or1' },
    { type: 'AND', _id: 'andA', group: 'or1', sort: 1 },
    { type: 'AND', _id: 'andB', group: 'or1', sort: 2 },
    { type: 'linked', _id: 'sword', key: 'phbwepLongsword', group: 'andA', sort: 1 },
    { type: 'focus', _id: 'focus1', key: 'holy', group: 'andA' },
    { type: 'OR', _id: 'choiceOr', group: 'andA' },
    { type: 'linked', _id: 'opt1', key: 'phbagPack', group: 'choiceOr', sort: 1 },
    { type: 'linked', _id: 'opt2', key: 'phbagKit', group: 'choiceOr', sort: 2 },
    { type: 'linked', _id: 'axe', key: 'phbwepAxe', group: 'andB' }
  ]);
  assert.equal(dualPackage.mode, 'packages');
  assert.equal(dualPackage.packages.length, 2);
  assert.equal(dualPackage.packages[0].choices.length, 1);

  const orLinked = buildStartingPackages([
    { type: 'OR', _id: 'or2' },
    { type: 'linked', _id: 'a', key: 'itemA', group: 'or2' },
    { type: 'linked', _id: 'b', key: 'itemB', group: 'or2' }
  ]);
  assert.equal(orLinked.packages.length, 2);

  const singleAnd = buildStartingPackages([
    { type: 'AND', _id: 'and1' },
    { type: 'linked', key: 'phbwepDagger', group: 'and1' }
  ]);
  assert.equal(singleAnd.mode, 'single');

  const multiAnd = buildStartingPackages([
    { type: 'AND', _id: 'and1' },
    { type: 'AND', _id: 'and2' },
    { type: 'linked', key: 'x', group: 'and1' },
    { type: 'linked', key: 'y', group: 'and2' }
  ]);
  assert.equal(multiAnd.mode, 'packages');

  const flat = buildStartingPackages([
    { type: 'linked', key: 'phbwepClub' }
  ]);
  assert.equal(flat.mode, 'single');
  assert.deepEqual(buildStartingPackages([{ type: 'OR', _id: 'empty' }]), {
    packages: [], mode: 'empty'
  });

  const choiceId = dualPackage.packages[0].choices[0].id;
  const optionId = dualPackage.packages[0].choices[0].options[1].id;
  const items = resolveSelectedPackageItems(dualPackage.packages[0], {
    [choiceId]: optionId
  });
  assert.ok(items.some((item) => item.id === optionId || item.key === 'phbagKit'));
  assert.deepEqual(resolveSelectedPackageItems(null), []);
  const defaultChoice = resolveSelectedPackageItems({
    items: [{ id: 'base' }],
    choices: [{ id: 'c1', options: [{ id: 'first' }, { id: 'second' }] }]
  }, {});
  assert.ok(defaultChoice.some((item) => item.id === 'first'));
});

test('multipath settings helpers and forceRender/getOpenApp', async () => {
  const multipath = await import('../core/multipath.js');
  const store = new Map();
  globalThis.game = {
    settings: {
      get: (_mod, key) => {
        if (!store.has(key)) throw new Error('missing');
        return store.get(key);
      },
      set: async (_mod, key, value) => { store.set(key, value); }
    }
  };
  assert.deepEqual(multipath.readListSetting('list'), []);
  store.set('list', [1, 2]);
  assert.deepEqual(multipath.readListSetting('list'), [1, 2]);
  store.set('list', { items: [3] });
  assert.deepEqual(multipath.readListSetting('list'), [3]);
  store.set('list', { a: { id: 1 }, b: null, c: [1] });
  assert.deepEqual(multipath.readListSetting('list'), [{ id: 1 }]);
  await multipath.writeListSetting('list', ['x']);
  assert.deepEqual(store.get('list'), { items: ['x'] });
  await multipath.writeListSetting('list', null);
  assert.deepEqual(store.get('list'), { items: [] });

  assert.deepEqual(multipath.readMapSetting('map'), {});
  store.set('map', null);
  assert.deepEqual(multipath.readMapSetting('map'), {});
  store.set('map', { byId: { a: { v: 1 } } });
  assert.deepEqual(multipath.readMapSetting('map'), { a: { v: 1 } });
  store.set('map', { a: { v: 2 }, byId: 1, items: [] });
  assert.deepEqual(multipath.readMapSetting('map'), { a: { v: 2 } });
  await multipath.writeMapSetting('map', { z: 1 });
  assert.deepEqual(store.get('map'), { byId: { z: 1 } });
  await multipath.writeMapSetting('map', null);
  assert.deepEqual(store.get('map'), { byId: {} });

  assert.equal(await multipath.forceRender(null), null);
  const app = {
    id: 'app-1',
    element: { style: {}, 0: null },
    bringToFront: () => { app.front = true; },
    render: async () => app
  };
  // element as non-HTMLElement array-like
  app.element = [{ style: {} }];
  globalThis.document = {
    querySelectorAll: () => [{ /* no style path uses getComputedStyle */ }]
  };
  globalThis.window = {
    getComputedStyle: () => ({ zIndex: '50' })
  };
  // HTMLElement check fails for plain object; use real-ish element
  const el = { style: {} };
  Object.setPrototypeOf(el, globalThis.HTMLElement?.prototype || Object.prototype);
  // force path without HTMLElement instance
  app.element = { 0: { style: {} } };
  await multipath.forceRender(app);
  await new Promise((resolve) => queueMicrotask(resolve));

  const failing = {
    render: () => { throw new Error('render fail'); }
  };
  await assert.rejects(() => multipath.forceRender(failing), /render fail/);

  globalThis.foundry = {
    applications: {
      instances: {
        values: () => [{ id: 'open-a', options: { id: 'opt-a' } }, { options: { id: 'open-b' } }].values()
      }
    }
  };
  globalThis.ui = { windows: { 1: { id: 'legacy' } } };
  assert.equal(multipath.getOpenApp('open-a').id, 'open-a');
  assert.equal(multipath.getOpenApp('open-b').options.id, 'open-b');
  assert.equal(multipath.getOpenApp('legacy').id, 'legacy');
  assert.equal(multipath.getOpenApp('missing'), null);
  assert.equal(multipath.MODULE_ID, 'ld-axyum');
});

test('roll table manager loads tables and rolls biography traits', async () => {
  const { RollTableManager } = await import('../core/roll-table-manager.js');
  const previous = {
    fetch: globalThis.fetch,
    ui: globalThis.ui,
    random: Math.random
  };
  const infos = [];
  const errors = [];
  globalThis.ui = {
    notifications: {
      info: (message) => infos.push(message),
      error: (message) => errors.push(message)
    }
  };
  const manager = new RollTableManager();
  assert.deepEqual(manager.getAvailableTables().sort(), [
    'bonds', 'flaws', 'ideals', 'personality-traits'
  ].sort());
  assert.equal(manager.hasTable('ideals'), true);
  assert.equal(manager.hasTable('missing'), false);
  assert.equal(await manager.rollOnTable('missing'), null);

  globalThis.fetch = async () => ({ ok: false });
  assert.equal(await manager.rollOnTable('ideals'), null);

  Math.random = () => 0; // roll 1
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({
      name: 'Ideals',
      results: [
        { range: [1, 50], description: 'Honor' },
        { range: [51, 100], description: 'Chaos' }
      ]
    })
  });
  assert.equal(await manager.rollIdeal(), 'Honor');
  Math.random = () => 0.9; // roll 91
  assert.equal(await manager.rollOnTable('ideals'), 'Chaos');
  Math.random = () => 0.5;
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({ name: 'Empty', results: [{ range: [1, 1], description: 'x' }] })
  });
  // roll 51 misses range
  assert.equal(await manager.rollOnTable('ideals'), null);

  globalThis.fetch = async () => { throw new Error('network'); };
  assert.equal(await manager.rollOnTable('bonds'), null);
  assert.equal(errors.includes('Failed to roll on table'), true);

  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({
      name: 'T',
      results: [{ range: [1, 100], description: 'ok' }]
    })
  });
  Math.random = () => 0;
  const all = await manager.rollAllBiographyTraits();
  assert.equal(all.personalityTrait, 'ok');
  assert.equal(all.ideal, 'ok');
  assert.equal(all.bond, 'ok');
  assert.equal(all.flaw, 'ok');

  Math.random = previous.random;
  globalThis.fetch = previous.fetch;
  globalThis.ui = previous.ui;
});
