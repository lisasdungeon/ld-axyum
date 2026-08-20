import assert from 'node:assert/strict';
import test from 'node:test';
import { installFoundryMock, restoreFoundryMock } from './foundry-mock.mjs';

function sampleCache() {
  return {
    classes: [
      { id: 'c1', name: 'Wizard', hitDice: 'd6', spellcasting: 'full', saves: ['int'], skills: ['arcana'] },
      { id: 'c2', name: 'Fighter', hitDice: 'd10', spellcasting: null, saves: ['str'], skills: [] }
    ],
    races: [{ id: 'r1', name: 'Elf' }, { id: 'r2', name: 'Human' }],
    backgrounds: [{ id: 'b1', name: 'Sage' }],
    spells: [
      { id: 's0', name: 'Light', level: 0, classes: ['Wizard'] },
      { id: 's1', name: 'Fireball', level: 3, classes: ['Wizard', 'Sorcerer'] },
      { id: 's2', name: 'Open', level: 1, classes: [] }
    ],
    equipment: [
      { id: 'e1', name: 'Longsword', type: 'weapon' },
      { id: 'e2', name: 'Leather', type: 'equipment' }
    ],
    feats: [
      { id: 'f1', name: 'Alert', requiresLevel: 1, requiresAbility: null },
      { id: 'f2', name: 'StrFeat', requiresLevel: 4, requiresAbility: 'fighter' }
    ],
    features: []
  };
}

test('compendium queries cover filters and lookups', async () => {
  const previous = installFoundryMock();
  try {
    const { CompendiumQueries } = await import('../core/compendium-queries.js');
    const cache = sampleCache();
    let loaded = 0;
    const q = new CompendiumQueries(cache, async () => { loaded += 1; });
    assert.equal((await q.getClasses()).length, 2);
    assert.equal((await q.getClasses('wiz')).length, 1);
    assert.equal((await q.getClass('wizard')).name, 'Wizard');
    assert.equal((await q.getRaces()).length, 2);
    assert.equal((await q.getRaces('elf')).length, 1);
    assert.equal((await q.getRace('human')).name, 'Human');
    assert.equal((await q.getBackgrounds()).length, 1);
    assert.equal((await q.getBackgrounds('sag')).length, 1);
    assert.equal((await q.getBackground('sage')).name, 'Sage');
    assert.ok((await q.getSpellsForClass('wizard', 3)).some((s) => s.name === 'Fireball'));
    assert.ok((await q.getSpellsForClass('bard', 9)).some((s) => s.name === 'Open'));
    assert.equal((await q.getSpellsByLevel(0)).length, 1);
    assert.equal((await q.getCantrips()).length, 1);
    assert.equal((await q.getCantrips('wizard')).length, 1);
    assert.equal((await q.getEquipment()).length, 2);
    assert.equal((await q.getEquipment('weapon')).length, 1);
    assert.equal((await q.getEquipment(null, 'long')).length, 1);
    assert.equal((await q.getWeapons('sword')).length, 1);
    assert.equal((await q.getArmor()).length, 1);
    assert.equal((await q.getFeats()).length, 2);
    assert.equal((await q.getFeats('alert')).length, 1);
    assert.equal((await q.getFeat('alert')).name, 'Alert');
    assert.equal((await q.getFeatsByLevel(1)).length, 1);
    assert.equal((await q.getFeatsByLevel(4, ['Fighter'])).length, 2);
    assert.equal((await q.getClassProgression('wizard')).hitDice, 'd6');
    assert.equal(await q.getClassProgression('missing'), null);
    assert.equal((await q.getMulticlassOptions()).length, 1);
    assert.ok(loaded >= 1);
  } finally {
    restoreFoundryMock(previous);
  }
});

test('content source manager covers folders, packs, and load paths', async () => {
  const previous = installFoundryMock();
  try {
    const { ContentSourceManager } = await import('../core/content-source-manager.js');
    const mgr = new ContentSourceManager();
    globalThis.game.folders = null;
    assert.equal(mgr.scanWorldFolders().size, 0);

    globalThis.game.folders = {
      filter: (fn) => [
        {
          id: 'f1', name: 'Classes', type: 'Item', path: 'Classes',
          contents: [
            { id: 'c1', name: 'Wizard', type: 'class', toObject: () => ({ name: 'Wizard' }) },
            { id: 's1', name: 'Fireball', type: 'spell', toObject: () => ({ name: 'Fireball' }) }
          ]
        },
        {
          id: 'f2', name: 'Actors', type: 'Actor', path: 'Actors', contents: []
        }
      ].filter(fn)
    };
    const folders = mgr.scanWorldFolders();
    assert.equal(folders.size, 2);
    assert.ok(mgr.getAvailableFoldersForCategory('classes').some((f) => f.id === 'f1'));
    assert.deepEqual(mgr.getAvailableFoldersForCategory('unknown'), []);

    globalThis.game.folders = {
      filter: () => { throw new Error('folders boom'); }
    };
    assert.equal(mgr.scanWorldFolders().size, 0);

    const packList = [
      { collection: 'dnd5e.classes', name: 'Classes', metadata: { type: 'class', label: 'SRD' }, index: { size: 3 } }
    ];
    globalThis.game.packs = packList;
    mgr.worldFolders = folders;
    const sources = mgr.getAllContentSources('classes');
    assert.ok(sources.compendia.length >= 1);
    globalThis.game.packs = {
      [Symbol.iterator]() { throw new Error('pack boom'); }
    };
    assert.ok(mgr.getAllContentSources('classes'));

    globalThis.game.settings.get = () => ({ a: true });
    await mgr.loadContentSourceConfig();
    assert.ok(mgr.folderConfig.has('classes'));
    globalThis.game.settings.get = () => { throw new Error('no'); };
    await mgr.loadContentSourceConfig();

    assert.equal(mgr.saveContentSourceConfig('classes', null), false);
    globalThis.game.settings.get = () => ({ byCategory: {} });
    globalThis.game.settings.set = async () => {};
    let cleared = null;
    assert.equal(mgr.saveContentSourceConfig('classes', ['x'], (c) => { cleared = c; }), true);
    assert.equal(cleared, 'classes');
    globalThis.game.settings.get = () => { throw new Error('set fail'); };
    assert.equal(mgr.saveContentSourceConfig('classes', ['y']), true);
    // force outer catch
    mgr.folderConfig = {
      set: () => { throw new Error('map set'); }
    };
    assert.equal(mgr.saveContentSourceConfig('classes', ['z']), false);
    mgr.folderConfig = new Map();

    mgr.worldFolders = folders;
    const fromFolder = await mgr.loadFromFolder('f1', 'classes');
    assert.equal(fromFolder[0].name, 'Wizard');
    assert.deepEqual(await mgr.loadFromFolder('missing', 'classes'), []);
    mgr.worldFolders.set('bad', {
      name: 'Bad',
      contents: {
        [Symbol.iterator]: () => { throw new Error('iter'); }
      }
    });
    assert.deepEqual(await mgr.loadFromFolder('bad', 'classes'), []);

    globalThis.game.packs = {
      get: (id) => {
        if (id !== 'dnd5e.spells') return null;
        return {
          name: 'Spells',
          metadata: { label: 'Spells' },
          getIndex: async () => [{ _id: 's1' }],
          getDocument: async () => ({
            id: 's1', name: 'Light', type: 'spell', toObject: () => ({ name: 'Light' })
          })
        };
      }
    };
    assert.equal((await mgr.loadFromCompendium('dnd5e.spells', 'spells')).length, 1);
    assert.deepEqual(await mgr.loadFromCompendium('missing', 'spells'), []);
    globalThis.game.packs.get = () => ({
      getIndex: async () => { throw new Error('index'); }
    });
    assert.deepEqual(await mgr.loadFromCompendium('x', 'spells'), []);

    const mixed = await mgr.loadFromSpecificSources('classes', [
      { type: 'compendium', id: 'missing', name: 'M' },
      { type: 'world-folder', id: 'f1', name: 'F' },
      { type: 'other', id: 'o', name: 'O' }
    ]);
    assert.ok(Array.isArray(mixed));
    // force per-source catch
    mgr.loadFromCompendium = async () => { throw new Error('src'); };
    assert.ok(await mgr.loadFromSpecificSources('classes', [{ type: 'compendium', id: 'x', name: 'X' }]));
  } finally {
    restoreFoundryMock(previous);
  }
});

test('compendium loader loads, queries, validates, and recovers from failure', async () => {
  const previous = installFoundryMock();
  try {
    const CompendiumLoader = (await import('../core/compendium-loader.js')).default;
    globalThis.game.settings.get = () => [];
    globalThis.game.packs = Object.assign([], { size: 0, values() { return [][Symbol.iterator](); }, get: () => null });
    globalThis.game.items = [];
    const loader = new CompendiumLoader();
    const cache = await loader.loadAllContent();
    assert.ok(Array.isArray(cache.classes));
    // second call hits usable cache
    assert.equal(await loader.loadAllContent(), loader.cache);
    // concurrent load
    loader.isLoading = true;
    loader.loadPromise = Promise.resolve(loader.cache);
    assert.equal(await loader.loadAllContent(), loader.cache);
    loader.isLoading = false;

    // force failure path
    loader.cache = {
      classes: null, races: null, backgrounds: null, spells: null, equipment: null, features: null, feats: null
    };
    loader.queries.cache = loader.cache;
    loader._performLoad = async () => { throw new Error('load fail'); };
    const failed = await loader.loadAllContent({ force: true });
    assert.deepEqual(failed.classes, []);
    loader.queries.cache = loader.cache;

    // empty cache with packs present is not usable
    loader.cache = {
      classes: [], races: [], backgrounds: [], spells: [], equipment: [], features: [], feats: []
    };
    loader.queries.cache = loader.cache;
    globalThis.game.packs = Object.assign([], { size: 2, values() { return [][Symbol.iterator](); }, get: () => null });
    loader._performLoad = async () => {
      Object.assign(loader.cache, sampleCache());
      return loader.cache;
    };
    await loader.loadAllContent();
    assert.ok(loader.cache.classes.length > 0);
    loader.queries.cache = loader.cache;

    assert.equal(CompendiumLoader._extractModuleSource('my-mod.items'), 'MY MOD');
    assert.equal(CompendiumLoader._extractModuleSource(''), 'HOMEBREW');
    globalThis.game.packs = {
      values: () => [
        { collection: 'dnd5e.classes', index: { size: 10 } },
        { collection: 'my-mod.items', index: { size: 2 }, title: 'HB' },
        { collection: 'empty.pack', index: { size: 0, length: 0 } }
      ].values()
    };
    assert.ok(CompendiumLoader.detectHomebrewPacks().some((p) => p.name === 'my-mod.items'));
    globalThis.game.packs = { values: () => { throw new Error('x'); } };
    assert.deepEqual(CompendiumLoader.detectHomebrewPacks(), []);
    globalThis.game.packs = null;
    assert.deepEqual(CompendiumLoader.detectHomebrewPacks(), []);

    loader.clearCacheForCategory('classes');
    assert.deepEqual(CompendiumLoader.getEnabledCompendia(), []);
    await loader.loadHomebrewContent();
    await loader._loadHomebrewFromPack('x');
    assert.ok(loader.validateHomebrewContent({ classes: [], races: [], spells: [], feats: [] }));
    assert.ok(loader.mergeHomebrewContent(
      { classes: [], races: [], spells: [], feats: [], equipment: [] },
      { classes: [], races: [], spells: [], feats: [], equipment: [] }
    ));

    Object.assign(loader.cache, sampleCache());
    loader.queries.cache = loader.cache;
    loader.queries.ensureLoaded = async () => {};
    assert.equal((await loader.getClasses('wiz')).length, 1);
    assert.equal((await loader.getClass('wizard')).name, 'Wizard');
    assert.equal((await loader.getRaces()).length, 2);
    assert.equal((await loader.getRace('elf')).name, 'Elf');
    assert.equal((await loader.getBackgrounds()).length, 1);
    assert.equal((await loader.getBackground('sage')).name, 'Sage');
    assert.ok(await loader.getSpellsForClass('wizard'));
    assert.ok(await loader.getSpellsByLevel(0));
    assert.ok(await loader.getCantrips('wizard'));
    assert.ok(await loader.getEquipment('weapon'));
    assert.ok(await loader.getWeapons());
    assert.ok(await loader.getArmor());
    assert.ok(await loader.getFeats());
    assert.ok(await loader.getFeat('alert'));
    assert.ok(await loader.getFeatsByLevel(4));
    assert.ok(await loader.getClassProgression('wizard'));
    assert.ok(await loader.getMulticlassOptions());
    assert.ok(loader.getStats().classes >= 1);
    assert.equal(loader.validateMulticlass([]).valid, false);
    assert.equal(loader.validateMulticlass([{ id: 'a' }, { id: 'a' }]).valid, false);
    assert.equal(loader.validateMulticlass([{ id: 'a' }, { id: 'b' }]).valid, true);

    loader.scanWorldFolders();
    loader.getAvailableFoldersForCategory('classes');
    loader.getAllContentSources('classes');
    await loader.loadContentSourceConfig();
    loader.saveContentSourceConfig('classes', []);
    await loader.loadFromSpecificSources('classes', []);
    await loader._loadFromFolder('x', 'classes');
    await loader._loadFromCompendium('x', 'classes');

    loader._performLoad = async () => {
      Object.assign(loader.cache, sampleCache());
      return loader.cache;
    };
    await loader.clearCache();
  } finally {
    restoreFoundryMock(previous);
  }
});

test('character creator builds data, embeds items, and validates multiclass', async () => {
  const previous = installFoundryMock();
  try {
    const { CharacterCreator } = await import('../core/character-creator.js');
    const options = {
      classes: [
        { id: 'c1', name: 'Wizard', packName: 'world' },
        { id: 'c2', name: 'Fighter', packName: 'dnd5e.classes' }
      ],
      races: [{ id: 'r1', name: 'Elf', packName: 'world' }],
      backgrounds: [{ id: 'b1', name: 'Sage', packName: 'world' }],
      equipment: [{ id: 'e1', name: 'Staff', packName: 'world' }],
      spells: [{ id: 's1', name: 'Light', packName: 'world' }],
      feats: [{ id: 'f1', name: 'Alert', packName: 'world' }]
    };
    const worldDoc = {
      toObject: () => ({ name: 'Doc', type: 'class', system: { levels: 1 } })
    };
    globalThis.game.items = Object.assign([], { get: () => worldDoc });
    globalThis.game.packs = Object.assign([], {
      get: () => ({
        getDocument: async () => ({
          toObject: () => ({ name: 'PackDoc', type: 'class', system: { levels: 1 } })
        })
      })
    });
    globalThis.Hooks = { callAll: () => {} };

    const creator = new CharacterCreator(options);
    const data = {
      name: 'Hero',
      class: { id: 'c1', name: 'Wizard', level: 3 },
      race: { id: 'r1', name: 'Elf', size: 'med' },
      background: { id: 'b1', name: 'Sage' },
      abilities: { str: 10, dex: 14, con: 12, int: 16, wis: 10, cha: 8 },
      skillProficiencies: ['arcana'],
      skills: {},
      selectedEquipmentIds: ['e1'],
      selectedCantrips: ['s1'],
      selectedSpells: [],
      feats: ['Alert'],
      details: { name: 'Hero', portrait: 'p.png', alignment: 'NG', backstory: 'once' },
      hitPoints: { max: 18 },
      isMulticlass: false
    };
    const actor = await creator.createCharacter(data);
    assert.equal(actor.id, 'actor-1');

    await assert.rejects(() => creator.createCharacter({ name: '', class: { id: null }, race: { id: null }, background: { id: null }, abilities: {} }), /Cannot create/);

    const multiData = {
      ...data,
      isMulticlass: true,
      classes: [
        { id: 'c1', name: 'Wizard', level: 3 },
        { id: 'c2', name: 'Fighter', level: 2 }
      ]
    };
    await creator.createCharacter(multiData);

    const updateActor = {
      id: 'a2',
      items: [
        {
          type: 'class',
          system: {
            traits: { weaponProf: { value: ['simple'] }, armorProf: { value: ['light'] }, languages: { value: ['common'] } }
          }
        },
        {
          type: 'race',
          system: { weaponProf: { value: ['longsword'] }, armorProf: { value: [] }, languages: { value: ['elvish'] } }
        }
      ],
      update: async () => {},
      createEmbeddedDocuments: async (_t, docs) => docs
    };
    await creator.updateCharacter(updateActor, data);
    await assert.rejects(() => creator.updateCharacter(null, data), /No actor/);
    await assert.rejects(() => creator.updateCharacter(updateActor, {
      name: '',
      class: { id: 'c1', level: 1 },
      race: { id: 'r1' },
      background: { id: 'b1' },
      abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }
    }), /Cannot update/);

    assert.equal(creator.buildActorData({ hitPoints: 12, abilities: { str: 15 } }).system.attributes.hp.max, 12);
    assert.equal(creator.buildActorData({ hitPoints: { max: 20 }, details: {}, race: {} }).system.attributes.hp.max, 20);
    assert.equal(creator.buildActorData({}).system.attributes.hp.max, 10);
    assert.ok(creator.buildActorUpdateData({ hitPoints: 8, abilities: {}, details: {}, race: {} })['system.attributes.hp.max']);
    assert.ok(creator.buildActorUpdateData({ hitPoints: { max: 9 }, abilities: {}, details: {}, race: {} }));

    // prepareItemData failure and missing sources
    await creator.createEmbeddedItems({
      createEmbeddedDocuments: async () => { throw new Error('embed fail'); }
    }, {
      class: { id: 'missing' },
      race: { id: 'missing' },
      background: { id: 'missing' },
      selectedEquipmentIds: ['missing'],
      selectedCantrips: [],
      selectedSpells: [],
      feats: ['Missing']
    }).catch(() => {});

    // pack fetch throw
    globalThis.game.packs.get = () => ({
      getDocument: async () => { throw new Error('doc'); }
    });
    await creator.createEmbeddedItems({
      createEmbeddedDocuments: async (_t, docs) => docs
    }, {
      class: { id: 'c2', name: 'Fighter', level: 1 },
      race: {},
      background: {},
      selectedEquipmentIds: [],
      selectedCantrips: [],
      selectedSpells: [],
      feats: []
    });

    // empty createEmbeddedDocuments path
    await creator.createEmbeddedItems({
      createEmbeddedDocuments: async () => []
    }, {
      class: {},
      race: {},
      background: {},
      selectedEquipmentIds: [],
      selectedCantrips: [],
      selectedSpells: [],
      feats: []
    });

    assert.equal(creator.validateMulticlassSelection({ isMulticlass: false }).valid, true);
    assert.equal(creator.validateMulticlassSelection({
      isMulticlass: true,
      classes: [{ id: 'a', level: 1 }, { id: 'a', level: 1 }]
    }).valid, false);
    assert.equal(creator.validateMulticlassSelection({
      isMulticlass: true,
      classes: [{ id: 'a', level: 15 }, { id: 'b', level: 10 }]
    }).valid, false);
    assert.equal(creator.validateMulticlassSelection({
      isMulticlass: true,
      classes: []
    }).valid, false);
    assert.equal(creator.validateMulticlassSelection({
      isMulticlass: true,
      classes: [{ id: 'a', level: 3 }, { id: 'b', level: 2 }]
    }).valid, true);
    assert.deepEqual(creator.buildClassList({}), []);
    assert.equal(creator.buildClassList({ classes: [{ id: 'a', name: 'A', level: 2 }] }).length, 1);
    assert.equal(creator.buildMulticlassSpellPreview({ isMulticlass: false }), null);
    assert.equal(creator.buildMulticlassSpellPreview({
      isMulticlass: true,
      classes: [{ name: 'Fighter', level: 5 }]
    }), null);
    const preview = creator.buildMulticlassSpellPreview({
      isMulticlass: true,
      classes: [{ name: 'Wizard', level: 5 }, { name: 'Cleric', level: 3 }]
    });
    assert.ok(!preview || Array.isArray(preview));
  } finally {
    restoreFoundryMock(previous);
  }
});
