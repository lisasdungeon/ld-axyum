import assert from 'node:assert/strict';
import test from 'node:test';
import { installFoundryMock, restoreFoundryMock } from './foundry-mock.mjs';
import { Pf2eCompendiumQueries } from '../systems/pf2e/data/pf2e-compendium-queries.js';

function el(dataset = {}) {
  return { dataset: { action: 'test', ...dataset }, closest: function closest() { return this; } };
}

function captureNotifications() {
  const notes = [];
  globalThis.ui.notifications = {
    info: (m) => notes.push(['info', m]),
    warn: (m) => notes.push(['warn', m]),
    error: (m) => notes.push(['error', m])
  };
  return notes;
}

const ELF = { id: 'elf', name: 'Elf', packName: 'p', hp: 8, size: 'sm', speed: 25, traits: ['elf'], boosts: ['dex', 'free'], flaws: ['str'] };
const WANDERER = { id: 'wan', name: 'Wanderer', packName: 'p', boosts: ['int', 'wis'], trainedSkill: 'athletics', loreSkill: '' };
const WIZARD = { id: 'wiz', name: 'Wizard', packName: 'p', hpPerLevel: 10, keyAbility: 'int', keyAbilityOptions: ['int'], classDC: 'trained', spellcasting: { tradition: 'arcane' } };
const FIGHTER = { id: 'fig', name: 'Fighter', packName: 'p', hpPerLevel: 10, keyAbility: 'str', keyAbilityOptions: ['str'], classDC: 'trained', spellcasting: null };
const SNOW = { id: 'snow', name: 'Snow', packName: 'p', ancestryId: 'elf' };
const CANTRIP = { id: 'light', name: 'Light', packName: 'p', rank: 0, traditions: ['arcane'] };
const FIREBALL = { id: 'fireball', name: 'Fireball', packName: 'p', rank: 1, traditions: ['arcane'] };
const HEAL = { id: 'heal', name: 'Heal', packName: 'p', rank: 1, traditions: ['divine'] };

const CACHE = {
  ancestries: [ELF],
  heritages: [SNOW],
  backgrounds: [WANDERER],
  classes: [WIZARD, FIGHTER],
  feats: { ancestry: [], class: [], skill: [], general: [], bonus: [] },
  spells: [CANTRIP, FIREBALL, HEAL],
  equipment: []
};

function stubLoader() {
  return { cache: CACHE, getOrLoadAll: async () => CACHE };
}

async function makeApp(overrides = {}) {
  const { Pf2eWizardApp } = await import('../systems/pf2e/wizard/pf2e-wizard-app.js');
  const app = new Pf2eWizardApp({ mode: 'create', ...overrides });
  app.compendium = stubLoader();
  app.render = async () => app;
  app.close = async () => { app.closed = true; };
  return app;
}

function completeScenario(app) {
  app.characterData.name = 'Test';
  app.characterData.ancestry = { id: 'elf', name: 'Elf', hp: 8, flaws: ['str'] };
  app.characterData.abilityBoosts.ancestry = ['dex'];
  app.characterData.background = { id: 'wan', name: 'Wanderer' };
  app.characterData.abilityBoosts.background = 'int';
  app.characterData.class = { id: 'wiz', name: 'Wizard', keyAbility: 'int', hpPerLevel: 10, spellcasting: { tradition: 'arcane' } };
  app.characterData.abilityBoosts.class = 'int';
  app.characterData.abilityBoosts.free = ['cha', 'con', 'wis', 'str'];
}

test('Pf2eCharacterModel validates pf2e requirements', async () => {
  const previous = installFoundryMock();
  try {
    const { Pf2eCharacterModel } = await import('../systems/pf2e/data/pf2e-character-model.js');
    const valid = {
      name: 'Sora', ancestry: { id: 'elf' }, background: { id: 'wan' }, class: { id: 'wiz' },
      abilityBoosts: { free: ['cha', 'con', 'wis', 'str'] }, level: 1
    };
    assert.deepEqual(Pf2eCharacterModel.validate(valid), { valid: true, errors: [] });

    const noName = Pf2eCharacterModel.validate({ ...valid, name: '  ' });
    assert.ok(noName.errors.includes('Character name is required'));

    const partial = Pf2eCharacterModel.validate({ name: 'X', abilityBoosts: { free: ['cha', 'cha', 'con', ''] }, level: 99 });
    assert.ok(partial.errors.includes('Character ancestry is required'));
    assert.ok(partial.errors.includes('Character background is required'));
    assert.ok(partial.errors.includes('Character class is required'));
    assert.ok(partial.errors.includes('All 4 free ability boosts must be assigned'));
    assert.ok(partial.errors.some((e) => e.includes('more than one free boost') && e.includes('CHA')));
    assert.ok(partial.errors.includes('Character level must be between 1 and 20'));

    const badKey = Pf2eCharacterModel.validate({ ...valid, abilityBoosts: { free: ['cha', 'con', 'wis', 'foo'] } });
    assert.ok(badKey.errors.some((e) => e.startsWith('Unknown ability key: foo')));

    assert.deepEqual(Pf2eCharacterModel.validate({ ...valid, level: '5' }), { valid: true, errors: [] });
    assert.ok(Pf2eCharacterModel.validate(null).errors.length > 0);
  } finally { restoreFoundryMock(previous); }
});

test('Pf2eCharacterModel normalizes partial data onto defaults with clamps', async () => {
  const previous = installFoundryMock();
  try {
    const { Pf2eCharacterModel } = await import('../systems/pf2e/data/pf2e-character-model.js');
    const defaults = Pf2eCharacterModel.getDefaults();
    assert.equal(defaults.level, 1);
    assert.equal(defaults.equipment.currency.gp, 15);
    assert.deepEqual(defaults.abilityBoosts.free, ['', '', '', '']);

    const out = Pf2eCharacterModel.normalize({
      name: 'Sora', level: '15',
      abilityBoosts: { free: ['cha', 'con', 'wis', 'str', 'int'] },
      proficiencies: { skills: { athletics: 'trained' } },
      feats: { skill: 'not-an-array' },
      languages: 'nope'
    });
    assert.equal(out.level, 15);
    assert.deepEqual(out.abilityBoosts.free, ['cha', 'con', 'wis', 'str']);
    assert.deepEqual(out.proficiencies.skills, { athletics: 'trained' });
    assert.deepEqual(out.proficiencies.saves, defaults.proficiencies.saves);
    assert.deepEqual(out.feats.skill, []);
    assert.deepEqual(out.feats.ancestry, []);
    assert.deepEqual(out.languages, []);
    assert.ok(out.ancestry && out.class && out.spells && out.details);
    assert.deepEqual(Object.keys(out).sort(), Object.keys(defaults).sort());

    assert.equal(Pf2eCharacterModel.normalize({ level: 99 }).level, 20);
    assert.equal(Pf2eCharacterModel.normalize({ level: 'abc' }).level, 1);
    assert.equal(Pf2eCharacterModel.normalize({ level: -3 }).level, 1);
    assert.equal(Pf2eCharacterModel.normalize(null).level, 1);

    const source = { name: 'Keep' };
    const clone = Pf2eCharacterModel.clone(source);
    clone.name = 'Changed';
    assert.equal(source.name, 'Keep');
    assert.equal(Pf2eCharacterModel.clone(null).name, '');
  } finally { restoreFoundryMock(previous); }
});

test('Context builders derive exact pf2e stats for a complete level 1 caster', async () => {
  const previous = installFoundryMock();
  try {
    const app = await makeApp();
    completeScenario(app);
    app.queries = app.queries || null;

    const stats = app._buildDerivedStats();
    assert.deepEqual(stats.abilities, { str: 10, dex: 12, con: 12, int: 14, wis: 12, cha: 12 });
    assert.deepEqual(stats.abilityModifiers, { str: 0, dex: 1, con: 1, int: 2, wis: 1, cha: 1 });
    assert.equal(stats.hp, 19);
    assert.deepEqual(stats.saves.fortitude, { rank: 'untrained', bonus: 1 });
    assert.deepEqual(stats.saves.reflex, { rank: 'untrained', bonus: 1 });
    assert.deepEqual(stats.saves.will, { rank: 'untrained', bonus: 1 });
    assert.equal(stats.perception, 1);
    assert.equal(stats.classDC, 15);
    assert.equal(stats.level, 1);

    const skills = app._buildSkillsList();
    assert.equal(skills.length, 16);
    const athletics = skills.find((s) => s.slug === 'athletics');
    assert.equal(athletics.label, 'Athletics');
    assert.equal(athletics.ability, 'str');
    assert.equal(athletics.rank, 'untrained');
    assert.equal(athletics.bonus, 0);
    const arcana = skills.find((s) => s.slug === 'arcana');
    assert.equal(arcana.ability, 'int');
    assert.equal(arcana.bonus, 2);
    assert.equal(skills.find((s) => s.slug === 'medicine').bonus, 1);

    app.characterData.proficiencies.saves.fortitude = 'trained';
    app.characterData.proficiencyWithoutLevel = true;
    const pwol = app._buildDerivedStats();
    assert.equal(pwol.saves.fortitude.rank, 'trained');
    assert.equal(pwol.saves.fortitude.bonus, 3);
    app.characterData.proficiencyWithoutLevel = false;
    assert.equal(app._buildDerivedStats().saves.fortitude.bonus, 4);

    app.navigation.goToPage('feats');
    await app.onNext();
    assert.equal(app.navigation.getCurrentPage(), 'spells');
    assert.ok(app._isSpellcaster());
    const preview = app._buildSpellPreview();
    assert.deepEqual(preview.slots, [2, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    assert.equal(preview.maxRank, 1);
    assert.equal(preview.cantripsKnown, 5);

    app.queries = new Pf2eCompendiumQueries(CACHE);
    const byRank = app._buildSpellsByRank();
    assert.deepEqual(byRank[0], [CANTRIP]);
    assert.deepEqual(byRank[1], [FIREBALL]);
  } finally { restoreFoundryMock(previous); }
});

test('Context builders gate spell content for non-casters and degrade on loader failure', async () => {
  const previous = installFoundryMock();
  try {
    const app = await makeApp();
    app.characterData.class = { id: 'fig', name: 'Fighter', keyAbility: 'str', hpPerLevel: 10, spellcasting: null };
    assert.equal(app._isSpellcaster(), false);
    assert.deepEqual(app._buildSpellsByRank(), {});
    assert.equal(app._buildSpellPreview(), null);

    app.navigation.goToPage('feats');
    await app.onNext();
    assert.equal(app.navigation.getCurrentPage(), 'equipment');
    app.navigation.goToPage('equipment');
    await app.onPrevious();
    assert.equal(app.navigation.getCurrentPage(), 'feats');

    const fallback = await makeApp();
    fallback.compendium = { getOrLoadAll: async () => { throw new Error('boom'); } };
    const cache = await fallback._loadAvailableOptions();
    assert.deepEqual(cache, {});
    assert.deepEqual(fallback.queries.getAncestries(), []);
    assert.deepEqual(fallback._buildFeatSections().map((s) => s.options), [[], [], [], []]);
  } finally { restoreFoundryMock(previous); }
});

test('Context builders load options and build feat sections from the cache', async () => {
  const previous = installFoundryMock();
  try {
    const app = await makeApp();
    const cache = await app._loadAvailableOptions();
    assert.equal(cache, CACHE);
    assert.equal(app.queries.getAncestries()[0].id, 'elf');
    app.characterData.feats.skill = ['a', 'b'];
    const sections = app._buildFeatSections();
    assert.deepEqual(sections.map((s) => s.category), ['ancestry', 'class', 'skill', 'general']);
    assert.deepEqual(sections.map((s) => s.slotsAvailable), [1, 1, 0, 0]);
    assert.equal(sections.find((s) => s.category === 'skill').selectedCount, 2);
    await app.onSelectAncestry(null, el({ ancestryId: 'elf' }));
    assert.equal(app._getFinalAbilities().dex, 12);
  } finally { restoreFoundryMock(previous); }
});

test('Selection handlers populate character data from query results', async () => {
  const previous = installFoundryMock();
  try {
    const app = await makeApp();
    app.queries = { getAncestries: () => [ELF], getHeritagesForAncestry: () => [SNOW], getBackgrounds: () => [WANDERER], getClasses: () => [WIZARD, FIGHTER] };

    await app.onSelectAncestry(null, el({ ancestryId: 'elf' }));
    assert.equal(app.characterData.ancestry.name, 'Elf');
    assert.deepEqual(app.characterData.abilityBoosts.ancestry, ['dex']);

    await app.onSelectHeritage(null, el({ heritageId: 'snow' }));
    assert.equal(app.characterData.heritage.name, 'Snow');

    await app.onSelectBackground(null, el({ backgroundId: 'wan' }));
    assert.equal(app.characterData.abilityBoosts.background, 'int');
    assert.equal(app.characterData.proficiencies.skills.athletics, 'trained');

    await app.onSelectClass(null, el({ classId: 'wiz' }));
    assert.equal(app.characterData.class.keyAbility, 'int');
    assert.equal(app.characterData.abilityBoosts.class, 'int');
    assert.equal(app.characterData.proficiencies.classDC, 'trained');

    await app.onSelectKeyAbility(null, el({ ability: 'wis' }));
    assert.equal(app.characterData.class.keyAbility, 'wis');
    assert.equal(app.characterData.abilityBoosts.class, 'wis');

    await app.onSelectAncestry(null, el({ ancestryId: 'ghost' }));
    await app.onSelectHeritage(null, el({}));
    await app.onSelectBackground(null, el({ backgroundId: 'ghost' }));
    await app.onSelectClass(null, el({}));
    await app.onSelectKeyAbility(null, el({}));
    assert.equal(app.characterData.ancestry.id, 'elf');
  } finally { restoreFoundryMock(previous); }
});

test('Boost assignment enforces the pf2e no-duplicate rule through warnings', async () => {
  const previous = installFoundryMock();
  try {
    const app = await makeApp();
    app.characterData.abilityBoosts.free = ['cha', 'con', 'wis', ''];
    const notes = captureNotifications();

    await app.onAssignBoost(null, el({ ability: 'cha', slot: '3' }));
    assert.deepEqual(notes[0], ['warn', 'Cannot apply more than one free boost to the same ability (CHA)']);
    assert.equal(app.characterData.abilityBoosts.free[3], '');

    await app.onAssignBoost(null, el({ ability: 'str', slot: '3' }));
    assert.deepEqual(app.characterData.abilityBoosts.free, ['cha', 'con', 'wis', 'str']);
    await app.onRemoveBoost(null, el({ slot: '3' }));
    assert.equal(app.characterData.abilityBoosts.free[3], '');
    await app.onAssignBoost(null, el({ ability: 'foo', slot: '3' }));
    assert.ok(notes.some(([, m]) => m.startsWith('Unknown ability key')));
    await app.onToggleProficiencyWithoutLevel(null);
    assert.equal(app.characterData.proficiencyWithoutLevel, true);
  } finally { restoreFoundryMock(previous); }
});

test('Toggle handlers manage skills feats spells and equipment selections', async () => {
  const previous = installFoundryMock();
  try {
    const app = await makeApp();
    await app.onToggleSkillTraining(null, el({ skill: 'stealth', rank: 'expert' }));
    assert.equal(app.characterData.proficiencies.skills.stealth, 'expert');

    await app.onToggleFeat(null, el({ category: 'skill', featId: 'f1' }));
    await app.onToggleFeat(null, el({ category: 'skill', featId: 'f2' }));
    assert.deepEqual(app.characterData.feats.skill, ['f1', 'f2']);
    await app.onToggleFeat(null, el({ category: 'skill', featId: 'f1' }));
    assert.deepEqual(app.characterData.feats.skill, ['f2']);

    await app.onToggleSpell(null, el({ spellId: 'light', cantrip: 'true' }));
    assert.deepEqual(app.characterData.spells.selectedCantrips, ['light']);
    await app.onToggleSpell(null, el({ spellId: 'fireball', rank: '1' }));
    await app.onToggleSpell(null, el({ spellId: 'flame', rank: '2' }));
    assert.deepEqual(app.characterData.spells.selectedSpells, { 1: ['fireball'], 2: ['flame'] });
    await app.onToggleSpell(null, el({ spellId: 'fireball', rank: '1' }));
    assert.deepEqual(app.characterData.spells.selectedSpells, { 1: [], 2: ['flame'] });
    await app.onToggleSpell(null, el({}));
    assert.deepEqual(app.characterData.spells.selectedCantrips, ['light']);

    await app.onToggleEquipment(null, el({ itemId: 'e1' }));
    await app.onToggleEquipment(null, el({ itemId: 'e2' }));
    assert.deepEqual(app.characterData.equipment.selectedIds, ['e1', 'e2']);
    await app.onToggleEquipment(null, el({ itemId: 'e1' }));
    assert.deepEqual(app.characterData.equipment.selectedIds, ['e2']);
  } finally { restoreFoundryMock(previous); }
});

test('onCreate normalizes validates creates the actor and closes', async () => {
  const previous = installFoundryMock();
  try {
    const app = await makeApp();
    completeScenario(app);
    const notes = captureNotifications();
    await app.onCreate();
    assert.deepEqual(notes, [['info', 'Created Test']]);
    assert.equal(app.closed, true);

    const blocked = await makeApp();
    const notes2 = captureNotifications();
    await blocked.onCreate();
    assert.equal(notes2[0][0], 'warn');
    assert.equal(blocked.closed, undefined);

    const failing = await makeApp();
    completeScenario(failing);
    captureNotifications();
    globalThis.Actor = class { static async create() { throw new Error('no actor'); } };
    await failing.onCreate();
    const last = globalThis.ui.notifications.calls;
  } finally { restoreFoundryMock(previous); }
});

test('onSave updates an existing actor instead of creating one', async () => {
  const previous = installFoundryMock();
  try {
    const app = await makeApp({ mode: 'edit' });
    completeScenario(app);
    const updates = [];
    app.actor = { name: 'Edit Me', items: [], update: async (patch) => { updates.push(patch); } };
    const notes = captureNotifications();
    await app.onSave();
    assert.equal(updates.length, 1);
    assert.equal(updates[0].system.attributes.hp.max, 19);
    assert.deepEqual(notes, [['info', 'Updated Edit Me']]);
    assert.equal(app.closed, undefined);

    const fresh = await makeApp();
    fresh.onCreate = async () => { fresh.createdViaSave = true; };
    await fresh.onSave();
    assert.equal(fresh.createdViaSave, true);
  } finally { restoreFoundryMock(previous); }
});
