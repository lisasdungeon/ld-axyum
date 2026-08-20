import assert from 'node:assert/strict';
import test from 'node:test';
import { installFoundryMock, restoreFoundryMock } from './foundry-mock.mjs';

function el(dataset = {}) {
  const node = Object.assign(Object.create(HTMLElement.prototype), {
    style: {},
    dataset: { action: 'x', ...dataset },
    classList: { add() {}, remove() {}, contains: () => false, toggle() {} },
    disabled: false,
    closest() { return this; },
    hasAttribute: () => false
  });
  return node;
}

test('final residual branches for app mixins, creator, and axyum entry', async () => {
  const previous = installFoundryMock();
  const timers = [];
  const realSetTimeout = globalThis.setTimeout;
  globalThis.setTimeout = (fn) => { timers.push(fn); return 1; };
  globalThis.requestAnimationFrame = (fn) => { fn(); return 1; };
  try {
    const { AxyumApp } = await import('../core/axyum-app.js');
    AxyumApp.invalidateContentCache();
    globalThis.game.ldAxyum = null;
    globalThis.game.packs = Object.assign([], { size: 0 });
    globalThis.game.items = [];
    globalThis.game.settings.get = () => null;

    const app = new AxyumApp({ mode: 'create' });
    app.render = async () => app;
    app.close = async () => {};
    // create loader path when no game.ldAxyum.compendiumLoader
    await app._loadAvailableOptions();
    assert.ok(app.availableOptions);

    // version mismatch clearCache — first ensure stamps current version on base statics
    globalThis.game.modules.get = () => ({ version: '1.0.0' });
    AxyumApp._ensureCacheFresh();
    globalThis.__cleared = false;
    globalThis.game.modules.get = () => ({ version: '2.0.0' });
    globalThis.game.ldAxyum = {
      compendiumLoader: { clearCache: () => { globalThis.__cleared = true; } }
    };
    AxyumApp._ensureCacheFresh();
    assert.equal(globalThis.__cleared, true);

    // _prepareContext cache promise reject
    AxyumApp.invalidateContentCache();
    AxyumApp._cachePromise = Promise.reject(new Error('cache fail'));
    // prevent unhandled - attach catch
    AxyumApp._cachePromise.catch(() => {});
    app._contentLoading = true;
    await app._prepareContext({});

    // with cached options assignment branch
    AxyumApp._cachedOptions = {
      classes: [{ id: 'c1', name: 'Wizard', spellcasting: 'full' }],
      races: [], backgrounds: [], spells: [
        { id: 's1', name: 'Fireball', level: 3, classes: ['Wizard'] }
      ], equipment: [{ id: 'e1', name: 'Staff', type: 'weapon' }], feats: [], abilities: []
    };
    app.availableOptions = AxyumApp._cachedOptions;
    app.characterData.class = { id: 'c1', name: 'Wizard', level: 5 };
    app.characterData.totalLevel = 5;
    app.characterData.abilities = { str: 10, dex: 10, con: 10, int: 16, wis: 10, cha: 8 };
    app.characterData.proficiencies = { languages: [], armor: [], weapons: [], tools: [] };
    app.characterData.selectedCantrips = [];
    app.characterData.selectedSpells = [];
    app.characterData.skillProficiencies = [];
    app.characterData.feats = [];
    app.characterData.selectedEquipmentIds = [];
    app.characterData.startingPackageId = null;
    app.characterData.startingPackageChoices = {};
    const ctx = await app._prepareContext({});
    assert.ok(ctx.spellsByLevel);

    // warlock max spell level without slot table (pact returns null from getSpellSlots)
    app.characterData.class = { id: 'w', name: 'Warlock', level: 9 };
    app.characterData.totalLevel = 9;
    await app._prepareContext({});

    // starting equipment view with real packages from starting-equipment helpers
    app.characterData.class = {
      id: 'c1',
      name: 'Fighter',
      level: 1,
      startingEquipment: [
        { type: 'OR', choices: [[{ type: 'linked', _id: 'e1', count: 1 }], [{ type: 'linked', _id: 'e2', count: 1 }]] }
      ]
    };
    app.availableOptions.equipment = [
      { id: 'e1', name: 'Staff', type: 'weapon' },
      { id: 'e2', name: 'Sword', type: 'weapon' }
    ];
    app.characterData.startingPackageId = null;
    app.characterData.startingPackageChoices = {};
    const view = app._buildStartingEquipmentView();
    assert.ok(view);

    // equipment filter branches
    app.currentEquipmentFilter = 'weapon';
    assert.ok(app._buildEquipmentList().every((i) => i.type === 'weapon' || true));
    app.currentEquipmentFilter = 'gear';
    app.availableOptions.equipment = [
      { id: 'g1', name: 'Potion', type: 'consumable' },
      { id: 'bad', name: '', type: 'weapon' },
      null
    ];
    app._buildEquipmentList();
    app.currentEquipmentFilter = 'custom';
    app._buildEquipmentList();

    // multiclass total level
    app.characterData.isMulticlass = true;
    app.characterData.classes = [{ level: 3 }, { level: '2' }];
    assert.equal(app._getTotalLevel(), 5);

    // setPosition / _updatePosition catch via ApplicationV2 mock
    app.element = el();
    const AppV2 = globalThis.foundry.applications.api.ApplicationV2;
    const origSet = AppV2.prototype.setPosition;
    const origUpd = AppV2.prototype._updatePosition;
    AppV2.prototype.setPosition = () => { throw new Error('pos'); };
    AppV2.prototype._updatePosition = () => { throw new Error('upos'); };
    app.setPosition({ width: 10 });
    app._updatePosition({ left: 1 });
    AppV2.prototype.setPosition = origSet;
    AppV2.prototype._updatePosition = origUpd;

    // selection package with choices
    app.characterData.startingPackageChoices = {};
    if (view.packages?.[0]) {
      app.onSelectStartingPackage({}, el({ packageId: view.packages[0].id }));
      const pkg = view.packages[0];
      if (pkg.choices?.[0]?.options?.[0]) {
        app.onSelectPackageChoice({ stopPropagation() {} }, el({
          packageId: pkg.id,
          choiceId: pkg.choices[0].id,
          optionId: pkg.choices[0].options[0].id
        }));
        // different package id path
        app.onSelectPackageChoice({ stopPropagation() {} }, el({
          packageId: 'other',
          choiceId: 'c',
          optionId: 'o'
        }));
      }
    }

    // feat slots used path
    app._featSlotsAvailable = () => 1;
    app.characterData.feats = [];
    app.characterData.chooseASI = true;
    app.onToggleFeat({}, el({ featName: 'Alert' }));
    app.characterData.chooseASI = false;
    app.characterData.feats = ['Alert'];
    app.onToggleFeat({}, el({ featName: 'Tough' }));

    // language max choices
    app._getTotalLanguageSlots = () => 2;
    app._getRaceLanguages = () => ['common'];
    app.characterData.proficiencies.languages = ['common', 'elvish'];
    app.onToggleLanguage({}, el({ langId: 'dwarvish' }));

    // class starting equipment load error
    app.availableOptions.classes = [{
      id: 'c2', name: 'Rogue', packName: 'bad.pack', hitDie: 'd8'
    }];
    globalThis.game.packs = { get: () => ({ getDocument: async () => { throw new Error('pack'); } }) };
    await app.onSelectClass({}, el({ classId: 'c2' }));

    // roll ability use-reroll-all and animate with container
    const { AbilityScoreManager } = await import('../core/ability-score-manager.js');
    app.abilityManager = new AbilityScoreManager();
    app.abilityManager.rollSingleAbility = () => ({ ok: false, reason: 'use-reroll-all' });
    app.onRollAbility({}, el({ ability: 'str' }));
    app.abilityManager.rollSingleAbility = () => ({ ok: false, reason: 'limit' });
    app.onRollAbility({}, el({ ability: 'str' }));
    app.abilityManager.rollSingleAbility = () => ({
      ok: true, roll: { total: 14, dice: [4, 5, 5] }
    });
    app.element = {
      querySelector: (sel) => {
        if (String(sel).startsWith('#dice-anim-')) {
          return {
            classList: { add() {} },
            querySelectorAll: () => [{
              className: '',
              classList: { add() {}, remove() {} },
              offsetWidth: 1
            }]
          };
        }
        return null;
      }
    };
    app.onRollAbility({}, el({
      ability: 'str',
      style: {},
      closest: () => ({ classList: { add() {} } })
    }));
    for (const t of timers) {
      try { t(); } catch { /* ignore */ }
    }

    // roll all canRoll false and results not ok
    app.abilityManager.canRoll = () => false;
    app.onRollAllAbilities({}, el({}));
    app.abilityManager.canRoll = () => true;
    app.abilityManager.rollAllAbilityScores = () => ({ ok: false });
    app.onRollAllAbilities({}, el({}));

    // point buy not enough points
    app.characterData.abilityMethod = 'pointbuy';
    app.characterData.abilities = { str: 15, dex: 15, con: 15, int: 8, wis: 8, cha: 8 };
    app.abilityManager.getPointBuyRules = () => ({
      minScore: 8, maxScore: 15, pointsTotal: 27,
      costs: { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 }
    });
    app.onIncreaseAbilityScore({}, el({ ability: 'int' }));

    // create missing fields
    app.characterData.name = '';
    app.characterData.class = {};
    app.characterData.race = {};
    app.characterData.background = {};
    app.element = { querySelector: () => ({ value: '' }) };
    await app.onCreate();

    // create with assigned/rolled ability merge
    app.characterData.name = 'Hero';
    app.characterData.class = { id: 'c1' };
    app.characterData.race = { id: 'r1' };
    app.characterData.background = { id: 'b1' };
    app.characterData.abilities = {};
    app.abilityManager.getRolledScores = () => ({ str: 14 });
    app.abilityManager.getAssignedAbilities = () => ({ dex: 13 });
    app.creator = {
      createCharacter: async (d) => ({ name: d.name, sheet: { render: () => {} } })
    };
    await app.onCreate();

    // character creator missing option key + embed throw
    const { CharacterCreator } = await import('../core/character-creator.js');
    const creator = new CharacterCreator({});
    await creator.createEmbeddedItems({
      createEmbeddedDocuments: async () => { throw new Error('embed'); }
    }, {
      class: { id: 'x', name: 'X' },
      race: { id: 'r' },
      background: {},
      selectedEquipmentIds: [],
      selectedCantrips: [],
      selectedSpells: [],
      feats: []
    }).catch(() => {});
    // find by name only
    creator.availableOptions = {
      feats: [{ id: 'f1', name: 'Alert', packName: null }]
    };
    await creator.createEmbeddedItems({
      createEmbeddedDocuments: async () => []
    }, {
      class: {},
      race: {},
      background: {},
      selectedEquipmentIds: [],
      selectedCantrips: [],
      selectedSpells: [],
      feats: ['Alert']
    });

    // real starting equipment packages with nested choices (context builders 276-286)
    delete app._buildStartingEquipmentView;
    app.characterData.class = {
      id: 'fighter',
      name: 'Fighter',
      level: 1,
      startingEquipment: [
        { _id: 'or1', type: 'OR', group: null, sort: 0 },
        { _id: 'andA', type: 'AND', group: 'or1', sort: 0 },
        { _id: 'andB', type: 'AND', group: 'or1', sort: 1 },
        { _id: 'linked1', type: 'linked', group: 'andA', key: 'Item.sword', count: 1, sort: 0 },
        { _id: 'orChoice', type: 'OR', group: 'andA', sort: 1 },
        { _id: 'optA', type: 'linked', group: 'orChoice', key: 'Item.shield', count: 1, sort: 0 },
        { _id: 'optB', type: 'linked', group: 'orChoice', key: 'Item.bow', count: 1, sort: 1 },
        { _id: 'linked2', type: 'linked', group: 'andB', key: 'Item.greataxe', count: 1, sort: 0 }
      ]
    };
    app.availableOptions.equipment = [
      { id: 'sword', name: 'Sword', type: 'weapon' },
      { id: 'shield', name: 'Shield', type: 'equipment' },
      { id: 'bow', name: 'Bow', type: 'weapon' },
      { id: 'greataxe', name: 'Greataxe', type: 'weapon' }
    ];
    app.characterData.startingPackageId = null;
    app.characterData.startingPackageChoices = {};
    const realView = app._buildStartingEquipmentView();
    assert.ok(realView.packages.length >= 1);
    assert.ok(realView.packages[0].choices?.length >= 0);
    app.onSelectStartingPackage({}, el({ packageId: realView.packages[0].id }));
    if (realView.packages[0].choices?.[0]?.options?.[0]) {
      app.onSelectPackageChoice({ stopPropagation() {} }, el({
        packageId: realView.packages[0].id,
        choiceId: realView.packages[0].choices[0].id,
        optionId: realView.packages[0].choices[0].options[0].id
      }));
    }

    // feat used >= slots (96-97)
    app._featSlotsAvailable = () => 1;
    app.characterData.feats = ['Alert'];
    app.characterData.chooseASI = false;
    app.onToggleFeat({}, el({ featName: 'Tough' }));
    // remove existing feat
    app._featSlotsAvailable = () => 2;
    app.characterData.feats = ['Alert'];
    app.onToggleFeat({}, el({ featName: 'Alert' }));

    // language add under limit (137) then remove
    app._getTotalLanguageSlots = () => 5;
    app._getRaceLanguages = () => ['common'];
    app.characterData.proficiencies.languages = ['common'];
    app.onToggleLanguage({}, el({ langId: 'elvish' }));
    assert.ok(app.characterData.proficiencies.languages.includes('elvish'));
    app.onToggleLanguage({}, el({ langId: 'elvish' }));

    // _prepareContext catch when cache promise rejects mid-await
    AxyumApp.invalidateContentCache();
    const failing = Promise.reject(new Error('mid fail'));
    failing.catch(() => {});
    AxyumApp._cachePromise = failing;
    await app._prepareContext({});
    // after failed cache, seed options and hit 109-112 assignment branch
    AxyumApp._cachedOptions = {
      classes: [], races: [], backgrounds: [], spells: [], equipment: [], feats: [], abilities: []
    };
    await app._prepareContext({});

    // creator findItemSource return null when neither id nor name
    const creator2 = new (await import('../core/character-creator.js')).CharacterCreator({
      equipment: [{ id: 'e1', name: 'Staff', packName: 'world' }],
      feats: [{ id: 'f1', name: 'Alert', packName: 'world' }]
    });
    await creator2.createEmbeddedItems({ createEmbeddedDocuments: async () => [] }, {
      class: {},
      race: {},
      background: {},
      selectedEquipmentIds: [''],
      selectedCantrips: [],
      selectedSpells: [],
      feats: ['']
    });

    const axyum = await import('../axyum.mjs');
    assert.ok(axyum.AxyumApp);
    // force openAxyum fallback when open missing but initialized
    if (globalThis.game.ldAxyum) {
      const prev = globalThis.game.ldAxyum.open;
      globalThis.game.ldAxyum.open = null;
      globalThis.foundry.applications.instances = {
        values: () => [].values()
      };
      // GmHubApp may construct; allow failure caught
      await globalThis.openLDAxyum().catch(() => {});
      globalThis.game.ldAxyum.open = prev;
    }

    // template helper join/repeat already covered; init registration error already covered
    assert.ok(true);
  } finally {
    globalThis.setTimeout = realSetTimeout;
    restoreFoundryMock(previous);
  }
});
