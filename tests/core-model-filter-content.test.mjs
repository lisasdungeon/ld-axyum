import assert from 'node:assert/strict';
import test from 'node:test';

test('character model validates, normalizes, clones, and serializes', async () => {
  const { CharacterModel } = await import('../core/character-model.js');
  assert.equal(CharacterModel.getDefaults().class.level, 1);
  assert.equal(CharacterModel.validate({
    name: '',
    class: { id: null, level: 1 },
    race: { id: null },
    background: { id: null },
    abilities: { str: 1, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }
  }).valid, false);

  const validBase = {
    name: 'Hero',
    class: { id: 'fighter', level: 3 },
    race: { id: 'human' },
    background: { id: 'soldier' },
    abilities: { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 },
    isMulticlass: false
  };
  assert.equal(CharacterModel.validate(validBase).valid, true);

  const multi = {
    ...validBase,
    isMulticlass: true,
    classes: [{ id: 'fighter', name: 'Fighter', level: 12 }, { id: 'rogue', name: 'Rogue', level: 12 }]
  };
  assert.equal(CharacterModel.validate(multi).valid, false);

  assert.equal(CharacterModel.normalize(null).name, '');
  const normalized = CharacterModel.normalize({
    name: 'A',
    class: { id: 'wizard', name: 'Wizard', level: '5' },
    abilities: { str: '16', dex: 'bad', con: 25, int: 2, wis: 10, cha: 10 },
    selectedEquipmentIds: 'nope',
    selectedCantrips: null,
    selectedSpells: undefined,
    details: { biography: 'bio' },
    feats: null,
    classes: [
      { id: 'wizard', name: 'Wizard', level: '18' },
      { id: 'fighter', name: 'Fighter', level: '5' }
    ]
  });
  assert.equal(normalized.abilities.str, 16);
  assert.equal(normalized.abilities.dex, 10);
  assert.equal(normalized.abilities.con, 20);
  assert.equal(normalized.abilities.int, 3);
  assert.equal(normalized.selectedEquipmentIds.length, 0);
  assert.equal(normalized.feats.length, 0);
  assert.ok(normalized.totalLevel <= 20);
  assert.equal(normalized.details.biography, 'bio');

  const clone = CharacterModel.clone(normalized);
  assert.notEqual(clone, normalized);
  assert.equal(CharacterModel.equals(normalized, clone), true);
  assert.equal(CharacterModel.equals(null, clone), false);
  const circular = {};
  circular.self = circular;
  assert.equal(CharacterModel.equals(circular, circular), false);
  assert.equal(CharacterModel.clone({ toJSON: () => { throw new Error('x'); } }).class.level, 1);

  assert.equal(CharacterModel.getAbilityModifier(16), 3);
  assert.ok(CharacterModel.getAbilityModifiers(normalized.abilities).str >= 0);
  assert.equal(CharacterModel.generateAbilityScores('pointbuy').str, 8);
  const json = CharacterModel.serialize(normalized);
  assert.equal(CharacterModel.deserialize(json).name, normalized.name);
  assert.equal(CharacterModel.deserialize('{bad').class.level, 1);
  assert.equal(CharacterModel.validateMulticlass({ classes: [] }).valid, false);
  assert.equal(CharacterModel.migrateToMulticlass({ class: { id: 'x', name: 'X', level: 1 } }).classes.length, 1);
  assert.equal(CharacterModel.getTotalLevel({ classes: [{ level: 2 }] }), 2);
  assert.equal(CharacterModel.getPrimaryClass({ classes: [{ name: 'P' }] }).name, 'P');
});

test('compendium filter and content transformers cover item shapes', async () => {
  const { CompendiumFilter } = await import('../core/compendium-filter.js');
  const filter = new CompendiumFilter();
  filter.setCompendiumFilter('class', 'phb');
  filter.setCompendiumFilter('race', 'srd');
  filter.setCompendiumFilter('background', 'tasha');
  filter.setCompendiumFilter('other', 'x');
  assert.equal(filter.getCompendiumFilter('class'), 'phb');
  assert.equal(filter.getCompendiumFilter('race'), 'srd');
  assert.equal(filter.getCompendiumFilter('background'), 'tasha');
  assert.equal(filter.getCompendiumFilter('other'), 'all');
  filter.setHomebrewVisibility(false);
  assert.equal(filter.getHomebrewVisibility(), false);
  filter.setSelectedRole(1);
  assert.equal(filter.getSelectedRole(), 1);
  assert.deepEqual(filter.filterHomebrewItems([{ isHomebrew: true }, { isHomebrew: false }]).map((i) => i.isHomebrew), [false]);
  assert.equal(filter.filterHomebrewItems('x'), 'x');
  filter.setHomebrewVisibility(true);
  assert.equal(filter.filterHomebrewItems([{ isHomebrew: true }]).length, 1);
  assert.deepEqual(filter.getRecommendedClassesForRole(0), ['Fighter', 'Paladin', 'Barbarian']);
  assert.equal(filter.getRecommendedClassesForRole(99), null);
  assert.equal(filter.isClassRecommendedForRole('Fighter', 0), true);
  assert.equal(filter.isClassRecommendedForRole('Wizard', 0), false);
  assert.equal(filter.isClassRecommendedForRole('x', null), false);
  assert.equal(filter.isClassRecommendedForRole('x', 7), false);
  assert.deepEqual(filter.filterClassesByRole(null), []);
  filter.setSelectedRole(null);
  assert.equal(filter.filterClassesByRole([{ name: 'A' }])[0].recommended, false);
  filter.setSelectedRole(7);
  assert.equal(filter.filterClassesByRole([{ name: 'A' }])[0].recommended, false);
  filter.setSelectedRole(0);
  const sorted = filter.filterClassesByRole([{ name: 'Wizard' }, { name: 'Fighter' }, { name: 'Barbarian' }]);
  assert.equal(sorted[0].recommended, true);
  assert.deepEqual(filter.filterByCompendium([{ packName: 'a' }, { packName: 'b' }], 'all'), [
    { packName: 'a' }, { packName: 'b' }
  ]);
  assert.equal(filter.filterByCompendium([{ packName: 'a' }, { packName: 'b' }], 'a').length, 1);
  assert.equal(filter.getSourceBadge(null), '');
  assert.match(filter.getSourceBadge({ source: 'PHB' }), /official/);
  assert.match(filter.getSourceBadge({ source: 'Home', isHomebrew: true }), /homebrew/);
  assert.equal(filter.getClassIcon('Wizard'), 'fas fa-hat-wizard');
  assert.equal(filter.getClassIcon('Unknown'), 'fas fa-star');
  assert.ok(Array.isArray(filter.applyAllFilters([{ name: 'Fighter', packName: 'phb' }], 'class')));
  assert.ok(Array.isArray(filter.applyAllFilters([{ packName: 'srd' }], 'race')));
  assert.ok(Array.isArray(filter.applyAllFilters([{ packName: 'tasha' }], 'background')));
  assert.ok(Array.isArray(filter.applyAllFilters(null, 'other')));
  filter.reset();
  assert.equal(filter.selectedRoleIndex, null);

  const transformers = await import('../core/content-transformers.js');
  const classDoc = {
    id: 'c1', name: 'Wizard', img: 'w.png',
    system: {
      spellcasting: { progression: 'full' },
      hitDice: 'd6',
      saves: { int: true, wis: true },
      primaryAbility: { int: true },
      skills: { arc: true },
      startingEquipment: [{ type: 'linked' }],
      description: { value: '<p>@UUID[Actor.x]{Name} Hello</p>' },
      source: { book: 'PHB' }
    }
  };
  const cls = transformers.ClassTransformer.transform(classDoc, 'dnd-players-handbook.classes');
  assert.equal(cls.spellcasting, 'full');
  assert.equal(cls.hitDice, 'd6');
  assert.match(cls.savesLabel, /INT/);
  assert.equal(transformers.ClassTransformer.transform({
    id: 'f', name: 'Fighter', system: { spellcasting: { progression: 'none' }, primaryAbility: ['str'], saves: ['str'] }
  }, 'world').spellcasting, null);
  assert.equal(transformers.ClassTransformer.transform({
    id: 'f', name: 'X', system: { primaryAbility: 'dex', hp: { denomination: 'd10' } }
  }, 'world').primaryAbility, 'DEX');

  const race = transformers.RaceTransformer.transform({
    id: 'r', name: 'Elf',
    system: {
      advancement: [{ type: 'Size', configuration: { sizes: ['med', 'sm'] } }],
      movement: { walk: 35 },
      senses: { darkvision: 60 },
      description: { value: 'elf' }
    }
  }, 'dnd5e.races');
  assert.match(race.sizeLabel, /Medium/);
  assert.equal(race.darkvision, '60 ft darkvision');
  assert.equal(transformers.RaceTransformer.transform({
    id: 'r2', name: 'Human', system: { traits: { size: 'lg', darkvision: false }, movement: { walk: 30 } }
  }, 'world').darkvision, null);

  const bg = transformers.BackgroundTransformer.transform({
    id: 'b', name: 'Sage',
    system: {
      skills: ['Arcana', { label: 'History' }, { name: 'Investigation' }, { value: 'Religion' }, {}],
      advancement: [{ type: 'Trait', configuration: { grants: ['skills:acr', 'skills:ste'] } }],
      description: { value: 'bg' }
    }
  }, 'world');
  assert.ok(bg.skills.includes('Arcana'));
  const bg2 = transformers.BackgroundTransformer.transform({
    id: 'b2', name: 'Modern',
    system: { advancement: [{ type: 'Trait', configuration: { grants: ['skills:arc'] } }] }
  }, 'world');
  assert.ok(bg2.skills.includes('Arcana'));
  const bg3 = transformers.BackgroundTransformer.transform({
    id: 'b3', name: 'ObjSkills',
    system: { skills: { animalHandling: true } }
  }, 'world');
  assert.ok(bg3.skills.some((s) => /animal/i.test(s)));

  const spell = transformers.SpellTransformer.transform({
    id: 's', name: 'Fireball',
    system: {
      level: 3, school: 'evo',
      properties: new Set(['ritual', 'concentration']),
      classes: ['Wizard', { name: 'Sorcerer' }],
      description: { value: 'boom' }
    }
  }, 'dnd5e.spells');
  assert.equal(spell.ritual, true);
  assert.equal(spell.concentration, true);
  assert.ok(spell.classes.includes('Wizard'));
  assert.equal(transformers.SpellTransformer.transform({
    id: 's2', name: 'X', system: { properties: ['ritual'], classes: { Wizard: true } }
  }, 'world').ritual, true);
  assert.equal(transformers.SpellTransformer.transform({
    id: 's3', name: 'Y', system: { properties: { concentration: true } }
  }, 'world').concentration, true);

  const equip = transformers.EquipmentTransformer.transform({
    id: 'e', name: 'Sword', type: 'weapon',
    system: { type: { value: 'martial' }, rarity: 'rare', weight: { value: 3 }, price: { value: 15 }, description: { value: 'sharp' } }
  }, 'world');
  assert.equal(equip.rarity, 'rare');
  assert.equal(equip.weight, 3);

  const feat = transformers.FeatTransformer.transform({
    id: 'ft', name: 'Alert',
    system: {
      requirements: 'Dex 13',
      prerequisites: { level: 4, items: ['x'] },
      description: { value: 'feat' }
    }
  }, 'world');
  assert.deepEqual(feat.prerequisites, ['Dex 13']);
  assert.equal(feat.requiresLevel, 4);
  const feat2 = transformers.FeatTransformer.transform({
    id: 'ft2', name: 'Tough', system: { requirements: ['A', 'B'] }
  }, 'world');
  assert.deepEqual(feat2.prerequisites, ['A', 'B']);
});

test('content loader extracts sources, loads packs, and dedupes', async () => {
  const {
    ContentLoader,
    extractSource,
    isHomebrewSource,
    isItemPack,
    itemPriority,
    packRank
  } = await import('../core/content-loader.js');

  assert.equal(extractSource('world', null, null), 'World');
  assert.equal(extractSource('x', null, { source: { book: "Tasha's Cauldron" } }), "Tasha's");
  assert.equal(extractSource('x', null, { source: { book: 'Player\'s Handbook 2024' } }), 'PHB 2024');
  assert.equal(extractSource('x', null, { source: { book: 'PHB' } }), 'PHB');
  assert.equal(extractSource('x', null, { source: { book: 'DMG' } }), 'DMG');
  assert.equal(extractSource('x', null, { source: { book: 'SRD 5.2' } }), 'SRD 5.2');
  assert.equal(extractSource('x', null, { source: { book: 'SRD 5.1' } }), 'SRD 5.1');
  assert.equal(extractSource('x', null, { source: { book: 'SRD' } }), 'SRD');
  assert.equal(extractSource('x', null, { source: { book: 'Custom Book' } }), 'Custom Book');
  assert.equal(extractSource('dnd-players-handbook.classes', null, null), 'PHB');
  assert.equal(extractSource('weird.pack-name', null, null).length > 0, true);
  assert.equal(isHomebrewSource('world', 'PHB'), true);
  assert.equal(isHomebrewSource('x', 'PHB'), false);
  assert.equal(isHomebrewSource('x', 'MyMod'), true);
  assert.equal(isItemPack({ documentName: 'Actor' }), false);
  assert.equal(isItemPack({ documentName: 'Item' }), true);
  assert.ok(packRank('dnd-players-handbook.classes') > packRank('unknown.pack'));
  assert.ok(itemPriority({ source: 'PHB', packName: 'world' }) >= 100);

  const packs = [
    {
      collection: 'dnd5e.classes',
      documentName: 'Item',
      metadata: {},
      getIndex: async ({ fields }) => {
        if (fields.includes('system.hitDice')) {
          return [
            { _id: 'w1', name: 'Wizard', type: 'class', img: null, system: { hitDice: 'd6', source: { book: 'SRD' } } },
            { _id: 'w2', name: 'Wizard', type: 'class', img: null, system: { hitDice: 'd6', source: { book: 'PHB' } } },
            { _id: 'a1', name: 'Actorish', type: 'actor', system: {} }
          ];
        }
        throw new Error('fields fail');
      }
    },
    {
      collection: 'world.home',
      documentName: 'Item',
      metadata: {},
      getIndex: async () => { throw new Error('bare fail'); }
    },
    {
      collection: 'skip.actors',
      documentName: 'Actor',
      metadata: {},
      getIndex: async () => []
    }
  ];
  globalThis.game = {
    items: [
      { id: 'wi', name: 'World Wizard', type: 'class', system: { hitDice: 'd6', source: { book: 'PHB' } } },
      { id: 'bad', name: 'Bad', type: 'class', system: {} }
    ],
    packs
  };
  const loader = new ContentLoader();
  const items = await loader.loadItemType('class', [], null);
  assert.ok(items.some((i) => i.name === 'Wizard'));
  const transformed = await loader.loadItemType('class', ['dnd5e.classes'], (doc, pack) => ({
    id: doc.id, name: doc.name, packName: pack, source: 'PHB'
  }));
  assert.ok(transformed.length >= 1);

  // transformer throw on world item
  const items2 = await loader.loadItemType('class', [], () => { throw new Error('t'); });
  assert.ok(Array.isArray(items2));

  // pack getIndex fields fail then bare works
  packs[0].getIndex = async ({ fields }) => {
    if (fields.length > 1) throw new Error('fields');
    return [{ _id: 'x', name: 'OnlyBare', type: 'class', system: {} }];
  };
  const bare = await loader.loadItemType('class', ['dnd5e.classes']);
  assert.ok(bare.some((i) => i.name === 'OnlyBare'));

  const raceItems = await loader.loadItemType('race', []);
  assert.ok(Array.isArray(raceItems));

  const cached = await loader.getOrLoad('class', ['dnd5e.classes']);
  const cached2 = await loader.getOrLoad('class', ['dnd5e.classes']);
  assert.equal(cached, cached2);
  const inflight = loader.getOrLoad('feat', []);
  const inflight2 = loader.getOrLoad('feat', []);
  await Promise.all([inflight, inflight2]);
  // forceReload reloads even when cached
  const forced = await loader.getOrLoad('class', ['dnd5e.classes'], null, true);
  assert.ok(Array.isArray(forced));
  loader.clearCacheFor('class');
  loader.clearCache();
});

test('compendium cache manager loads through transformers', async () => {
  const CompendiumCacheManager = (await import('../core/compendium-cache-manager.js')).default;
  const cache = {};
  CompendiumCacheManager.clearCacheForCategory(cache, 'classes');
  CompendiumCacheManager.clearCacheForCategory(cache, 'races');
  CompendiumCacheManager.clearCacheForCategory(cache, 'backgrounds');
  CompendiumCacheManager.clearCacheForCategory(cache, 'feats');
  CompendiumCacheManager.clearCacheForCategory(cache, 'spells');
  CompendiumCacheManager.clearCacheForCategory(cache, 'equipment');
  CompendiumCacheManager.clearCacheForCategory(cache, 'other');

  globalThis.game = {
    settings: {
      get: () => { throw new Error('no setting'); }
    },
    packs: []
  };
  assert.deepEqual(CompendiumCacheManager.getEnabledCompendia(), []);
  globalThis.game.settings.get = () => ['a', null, 'b'];
  assert.deepEqual(CompendiumCacheManager.getEnabledCompendia(), ['a', 'b']);
  globalThis.game.settings.get = () => ({ a: true, b: false, c: true });
  assert.deepEqual(CompendiumCacheManager.getEnabledCompendia().sort(), ['a', 'c']);

  const packList = [
    { collection: 'dnd-players-handbook.classes', documentName: 'Item' },
    { collection: 'dnd5e.spells', documentName: 'Item' },
    { collection: 'world.actors', documentName: 'Actor' }
  ];
  globalThis.game.packs = packList;
  assert.ok(CompendiumCacheManager.getOfficialBookPacks().includes('dnd-players-handbook.classes'));
  globalThis.game.packs = null;
  assert.deepEqual(CompendiumCacheManager.getOfficialBookPacks(), []);

  const contentLoader = {
    loadItemType: async (type, enabled) => {
      if (enabled.length && type === 'class') return [];
      return [{ name: type, source: 'PHB', packName: 'dnd5e.x' }];
    }
  };
  const transformers = {
    ClassTransformer: { transform: () => ({}) },
    RaceTransformer: { transform: () => ({}) },
    BackgroundTransformer: { transform: () => ({}) },
    SpellTransformer: { transform: () => ({}) },
    FeatTransformer: { transform: () => ({}) },
    EquipmentTransformer: { transform: () => ({}) }
  };
  globalThis.game = {
    settings: { get: () => ['only.pack'] },
    packs: packList
  };
  const loaded = await CompendiumCacheManager.performLoad(contentLoader, {}, transformers);
  assert.ok(loaded.classes.length >= 1);
  assert.ok(loaded.equipment.length >= 1);

  globalThis.game.settings.get = () => [];
  globalThis.game.packs = null;
  const empty = await CompendiumCacheManager.performLoad({
    loadItemType: async () => []
  }, {}, transformers);
  assert.deepEqual(empty.classes, []);

  await assert.rejects(() => CompendiumCacheManager.performLoad({
    loadItemType: async () => { throw new Error('fail'); }
  }, {}, transformers));
});
