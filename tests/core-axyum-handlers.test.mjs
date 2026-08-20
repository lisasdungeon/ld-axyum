import assert from 'node:assert/strict';
import test from 'node:test';
import { installFoundryMock, restoreFoundryMock } from './foundry-mock.mjs';

function el(props = {}) {
  const node = Object.assign(Object.create(HTMLElement.prototype), {
    style: {},
    dataset: { action: 'test', ...(props.dataset || {}) },
    classList: {
      _s: new Set(),
      add(v) { this._s.add(v); },
      remove(v) { this._s.delete(v); },
      contains(v) { return this._s.has(v); },
      toggle(v, force) {
        if (force === false) this._s.delete(v);
        else if (force === true || !this._s.has(v)) this._s.add(v);
        else this._s.delete(v);
      }
    },
    children: [],
    value: '',
    checked: false,
    type: 'text',
    name: '',
    disabled: false,
    textContent: '',
    hidden: false,
    scrollTop: 0,
    _listeners: {},
    ...props
  });
  // dataset may be overwritten by props spread — ensure action host + custom keys
  node.dataset = { action: 'test', ...(props.dataset || {}), ...(node.dataset || {}) };
  node.addEventListener = (t, fn) => {
    node._listeners[t] = node._listeners[t] || [];
    node._listeners[t].push(fn);
  };
  node.querySelector = props.querySelector || (() => null);
  node.querySelectorAll = props.querySelectorAll || (() => []);
  node.closest = props.closest || (() => node);
  node.hasAttribute = (a) => a in (props.attrs || {});
  node.matches = (sel) => props.matchesSel === sel;
  return node;
}

test('AxyumApp action handlers cover navigation selection abilities and choices', async () => {
  const previous = installFoundryMock();
  const timers = [];
  const realSetTimeout = globalThis.setTimeout;
  globalThis.setTimeout = (fn, ms) => { timers.push(fn); return timers.length; };
  globalThis.requestAnimationFrame = (fn) => { fn(); return 1; };
  try {
    const { AxyumApp } = await import('../core/axyum-app.js');
    globalThis.game.settings.get = (mod, key) => (mod === 'core' && key === 'globalAmbientVolume' ? 1 : null);
    globalThis.foundry.audio = { AudioHelper: { play: async () => {} } };
    const app2 = new AxyumApp({ mode: 'create' });
    app2.render = async () => app2;
    app2.close = async () => { app2.closed = true; };
    app2.element = el({
      querySelector: (sel) => {
        if (sel === 'input[name="name"]') return { value: 'Named' };
        if (sel.startsWith('#dice-anim-')) return null;
        if (sel.startsWith('[name=')) return { value: 'rolled trait' };
        return null;
      },
      querySelectorAll: () => []
    });
    app2.availableOptions = {
      classes: [
        { id: 'c1', name: 'Wizard', hitDie: 'd6', packName: 'world', startingEquipment: [] },
        { id: 'c2', name: 'Fighter', hitDie: 'd10', packName: 'dnd5e.classes' }
      ],
      races: [{ id: 'r1', name: 'Elf', movement: { walk: 35 } }],
      backgrounds: [{ id: 'b1', name: 'Sage' }],
      spells: [],
      equipment: [],
      feats: [{ name: 'Alert' }],
      abilities: []
    };
    app2.characterData = {
      class: { id: null },
      race: { id: null },
      background: { id: null },
      abilities: {},
      abilityMethod: null,
      skillProficiencies: [],
      feats: [],
      chooseASI: false,
      proficiencies: { languages: [], armor: [], weapons: [], tools: [] },
      selectedCantrips: [],
      selectedSpells: [],
      selectedEquipmentIds: [],
      startingPackageId: null,
      startingPackageChoices: {},
      name: '',
      details: {},
      totalLevel: 4
    };
    app2.creator = {
      createCharacter: async (d) => ({ name: d.name, sheet: { render: () => {} } }),
      updateCharacter: async () => {}
    };
    app2.rollTables = {
      rollOnTable: async () => 'Brave'
    };
    app2.abilityManager.rolledPool = [
      { value: 15, assigned: false },
      { value: 14, assigned: false }
    ];
    app2.abilityManager.assignedAbilities = {};

    await app2.onNext();
    await app2.onPrevious();
    await app2.onSelectClass({}, el({ dataset: { classId: 'c1' } }));
    await app2.onSelectClass({}, el({ dataset: { classId: 'missing' } }));
    await app2.onSelectClass({}, el({ dataset: { classId: 'c2' } }));
    app2.onSelectRace({}, el({ dataset: { raceId: 'r1' } }));
    app2.onSelectBackground({}, el({ dataset: { backgroundId: 'b1' } }));
    app2.onSelectRole({}, el({ dataset: { roleIndex: '0' } }));

    app2.onRollAbility({}, el({ dataset: { ability: 'str' }, disabled: true }));
    app2.onRollAbility({}, el({ dataset: { ability: 'str' }, style: {}, closest: () => ({ classList: { add() {} } }) }));
    // exhaust single rolls then hit limit/reroll-all messaging
    for (const ab of ['dex', 'con', 'int', 'wis', 'cha']) {
      app2.onRollAbility({}, el({ dataset: { ability: ab }, style: {} }));
    }
    app2.onRollAbility({}, el({ dataset: { ability: 'str' }, style: {} }));

    const { AbilityScoreManager } = await import('../core/ability-score-manager.js');
    app2.abilityManager = new AbilityScoreManager();
    app2.onRollAllAbilities({}, el({ disabled: true }));
    app2.onRollAllAbilities({}, el({}));
    app2.onRollAllAbilities({}, el({})); // second full roll -> limit/final
    app2.onRollAllAbilities({}, el({})); // limit path

    app2.characterData.abilities = { str: 15 };
    app2.abilityManager.assignedAbilities = { str: 15 };
    app2.abilityManager.rolledPool = [];
    app2.onUnassignScore({}, el({ dataset: { ability: 'str' } }));
    app2.onAssignScore({}, el({ dataset: { ability: 'dex', score: '14' } }));
    app2.onUseStandardArray();
    app2.onUsePointBuy();
    app2.onIncreaseAbilityScore({}, el({ dataset: { ability: 'str' } }));
    // max score / points
    app2.characterData.abilities = { str: 15, dex: 15, con: 15, int: 8, wis: 8, cha: 8 };
    app2.onIncreaseAbilityScore({}, el({ dataset: { ability: 'str' } }));
    app2.characterData.abilities.str = 15;
    app2.onIncreaseAbilityScore({}, el({ dataset: { ability: 'dex' } }));
    app2.onDecreaseAbilityScore({}, el({ dataset: { ability: 'str' } }));
    app2.onDecreaseAbilityScore({}, el({ dataset: { ability: 'int' } })); // min
    app2.onResetAbilities();
    app2.abilityManager.rolledPool = [{ value: 13, assigned: false }];
    app2.onAssignScoreClick({}, el({ dataset: { ability: 'wis' } }));
    await app2.onRollTrait({}, el({ dataset: { trait: 'details.traits' } }));
    await app2.onRollTrait({}, null);
    app2.onFilterCompendium({}, el({ dataset: { filter: 'phb' }, classList: { contains: () => false } }));
    app2.onFilterCompendium({}, el({ dataset: { filter: 'srd' }, classList: { contains: (c) => c === 'race-compendium-filter-btn' } }));
    app2.onToggleHomebrew({}, el({ matchesSel: 'input[type="checkbox"]', checked: true, matches: (s) => s === 'input[type="checkbox"]' }));
    app2.onToggleHomebrew({ target: { closest: () => ({ querySelector: () => ({ checked: false }) }) } }, el({ matches: () => false }));
    app2.onFilterEquipment({}, el({ dataset: { filter: 'weapon' }, closest: () => null }));

    await app2.onCreate();
    app2.characterData.name = 'X';
    app2.characterData.class = { id: 'c1' };
    app2.characterData.race = { id: 'r1' };
    app2.characterData.background = { id: 'b1' };
    await app2.onCreate();
    app2.creator.createCharacter = async () => { throw new Error('create fail'); };
    await app2.onCreate();
    app2.actor = { name: 'Edit' };
    await app2.onSave();
    app2.creator.updateCharacter = async () => { throw new Error('save fail'); };
    await app2.onSave();
    globalThis.game.user.isGM = false;
    await app2.onConfigureCompendia();
    globalThis.game.user.isGM = true;
    await app2.onConfigureCompendia();

    // choices handlers
    app2.onToggleEquipment();
    app2.characterData.class = {
      id: 'c1', name: 'Wizard', level: 1,
      startingEquipment: [{ type: 'OR', choices: [[{ type: 'linked', _id: 'e1', count: 1 }]] }]
    };
    // simpler package view path via empty packages
    app2.onSelectStartingPackage({}, el({ dataset: { packageId: 'p1' } }));
    app2.onSelectPackageChoice({ stopPropagation() {} }, el({
      dataset: { packageId: 'p1', choiceId: 'c', optionId: 'o1' }
    }));
    app2.characterData.class = { name: 'Wizard', level: 4, id: 'c1' };
    app2.onToggleSkill({}, el({ dataset: { skillKey: 'arc' } }));
    app2.onToggleSkill({}, el({ dataset: { skillKey: 'arc' } }));
    // fill skills
    const choices = app2._buildSkillChoices();
    app2.characterData.skillProficiencies = Array.from({ length: choices.total || 0 }, (_, i) => `s${i}`);
    app2.onToggleSkill({}, el({ dataset: { skillKey: 'new' } }));
    app2.onToggleFeat({}, el({ dataset: { featName: 'Alert' } }));
    app2.onToggleFeat({}, el({ dataset: { featName: 'Alert' } }));
    app2.characterData.feats = [];
    app2.characterData.chooseASI = false;
    // force no slots
    const realSlots = app2._featSlotsAvailable.bind(app2);
    app2._featSlotsAvailable = () => 0;
    app2.onToggleFeat({}, el({ dataset: { featName: 'Tough' } }));
    app2.onToggleASI();
    app2._featSlotsAvailable = () => 2;
    app2.onToggleASI();
    app2.onToggleASI();
    app2._featSlotsAvailable = realSlots;

    app2.onToggleLanguage({}, el({ dataset: { langId: 'elvish' } }));
    app2.onToggleLanguage({}, el({ dataset: { langId: 'elvish' } }));
    app2._getTotalLanguageSlots = () => 1;
    app2._getRaceLanguages = () => ['common'];
    app2.characterData.proficiencies.languages = ['common'];
    app2.onToggleLanguage({}, el({ dataset: { langId: 'dwarvish' } }));
    app2.onToggleArmorProf({}, el({ dataset: { armorId: 'light' } }));
    app2.onToggleArmorProf({}, el({ dataset: { armorId: 'light' } }));
    app2.onToggleWeaponProf({}, el({ dataset: { weaponId: 'simple' } }));
    app2.onToggleWeaponProf({}, el({ dataset: { weaponId: 'simple' } }));
    app2.onToggleToolProf({}, el({ dataset: { toolId: 'thieves' } }));
    app2.onToggleToolProf({}, el({ dataset: { toolId: 'thieves' } }));

    app2._onFormInputChange({ target: { name: '', value: '' } });
    app2._onFormInputChange({ target: { name: '__proto__.x', value: '1', type: 'text' } });
    app2._onFormInputChange({ target: { name: 'details.traits', value: 'bold', type: 'text' } });
    app2._onFormInputChange({ target: { name: 'level', value: '5', type: 'number' } });
    for (const t of timers) {
      try { t(); } catch { /* ignore */ }
    }

    const dragTarget = el({ dataset: { score: '14', sourceAbility: 'str', poolIndex: '0', fromAssigned: 'true' }, classList: { add() {}, remove() {} } });
    app2._onDragStart({
      currentTarget: dragTarget,
      dataTransfer: { effectAllowed: '', setData() {} }
    });
    app2._onDragEnd({ currentTarget: dragTarget });
    const zone = el({ dataset: { ability: 'dex' }, classList: { add() {}, remove() {} } });
    app2._onDragOver({ preventDefault() {}, dataTransfer: { dropEffect: '' }, currentTarget: zone });
    app2._onDragLeave({ currentTarget: zone });
    app2.characterData.abilities = { dex: 12, str: 14 };
    app2.abilityManager.rolledPool = [{ value: 14, assigned: false }];
    app2.abilityManager.rolledScores = { str: 14 };
    app2.abilityManager.diceBreakdowns = { str: '3d6' };
    app2.abilityManager.assignedAbilities = { str: 14 };
    app2._onDrop({
      preventDefault() {},
      currentTarget: zone,
      dataTransfer: {
        getData: () => JSON.stringify({
          score: '14', poolIndex: '0', sourceAbility: 'str', fromAssigned: true
        })
      }
    });
    app2._onDrop({
      preventDefault() {},
      currentTarget: zone,
      dataTransfer: { getData: () => 'not-json' }
    });
    app2._returnScoreToPool('wis');
    app2._playDropSound();
    globalThis.foundry.audio.AudioHelper.play = () => { throw new Error('audio'); };
    app2._playDropSound();
    globalThis.foundry.audio.AudioHelper.play = () => Promise.reject(new Error('rej'));
    app2._playDropSound();
    globalThis.game.settings.get = () => 0;
    app2._playDropSound();

    // Actor constructor path
    globalThis.Actor = class Actor {};
    const actor = new Actor();
    const editApp = new AxyumApp({ actor, mode: 'edit' });
    assert.equal(editApp.mode, 'edit');
  } finally {
    globalThis.setTimeout = realSetTimeout;
    restoreFoundryMock(previous);
  }
});
