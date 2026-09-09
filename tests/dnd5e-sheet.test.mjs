import assert from 'node:assert/strict';
import test from 'node:test';
import { installFoundryMock, restoreFoundryMock } from './foundry-mock.mjs';

function el(dataset = {}) {
  return { dataset: { action: 'test', ...dataset } };
}

function stubDialog({ prompts = [], confirms = [] } = {}) {
  const calls = { prompt: [], confirm: [] };
  let pi = 0;
  let ci = 0;
  globalThis.foundry.applications.api.DialogV2 = {
    prompt: async (opts) => { calls.prompt.push(opts); return prompts[pi++]; },
    confirm: async (opts) => { calls.confirm.push(opts); return confirms[ci++]; }
  };
  return calls;
}

function makeActor({ layout = undefined, spellItems = true, spellSlots = true } = {}) {
  const updates = [];
  const rolls = [];
  const savedLayouts = [];
  let currentLayout = layout;
  const spellItem = {
    id: 'spell-1', name: 'Magic Missile', type: 'spell',
    system: { level: 1, preparation: { prepared: false } },
    updates: [],
    update: async function (patch) { this.updates.push(patch); }
  };
  const items = [
    { id: 'w1', name: 'Longsword', type: 'weapon', system: { quantity: 1, equipped: true } },
    { id: 'e1', name: 'Rope', type: 'equipment', system: { quantity: 2, equipped: false } },
    { id: 't1', name: 'Thieves Tools', type: 'tool' },
    { id: 'f1', name: 'Brave', type: 'feat', system: {} },
    { id: 'race1', name: 'Elf', type: 'race' },
    { id: 'bg1', name: 'Sailor', type: 'background' },
    { id: 'cls1', name: 'Ranger', type: 'class', system: { levels: 5 } }
  ];
  if (spellItems) items.push(spellItem);
  items.get = (id) => items.find((i) => i.id === id);

  const actor = {
    name: 'Sora', img: 'face.png', uuid: 'Actor.abc', items,
    system: {
      abilities: {
        str: { value: 16, save: { value: 5 }, saveProf: { hasProficiency: true }, proficient: 1 },
        dex: { value: 14 },
        con: { value: 14, save: { value: 2 }, saveProf: { hasProficiency: false }, proficient: 0 }
      },
      skills: {
        acr: { value: 1, total: 5, ability: 'dex' },
        ste: { value: 2, total: 8 },
        ath: { value: 0, total: 2 }
      },
      attributes: {
        hp: { value: 45, max: 50, temp: 3 },
        ac: { value: 17 },
        init: { total: 3 },
        movement: { walk: 30 },
        hd: { value: 2, max: 4 },
        prof: 3
      },
      spells: spellSlots
        ? { spell1: { value: 2, max: 4 }, spell3: { value: 0, max: 0 }, pact: { value: 1, max: 2, level: 1 } }
        : {},
      details: { race: 'Elf Fallback', background: 'Sailor Fallback', trait: 'Brave', biography: { value: 'Born in the north.' } }
    },
    getFlag: (_s, key) => (key === 'sheetLayout' ? currentLayout : null),
    setFlag: async (_s, _k, value) => { savedLayouts.push(value); currentLayout = value; },
    update: async (patch) => updates.push(patch),
    rollAbilityCheck: async (o) => rolls.push(['ability', o]),
    rollSkill: async (o) => rolls.push(['skill', o]),
    rollSavingThrow: async (o) => rolls.push(['save', o]),
    rollHitDie: async () => rolls.push(['hitdie'])
  };
  return { actor, updates, rolls, savedLayouts, spellItem };
}

async function makeSheet(actor) {
  const { Dnd5eCharacterSheet } = await import('../systems/dnd5e/sheet/dnd5e-sheet.js');
  const sheet = new Dnd5eCharacterSheet({ document: actor });
  sheet.actor = actor;
  sheet.render = async () => sheet;
  return sheet;
}

test('Sheet context reads dnd5e derived data for abilities, skills, and combat', async () => {
  const previous = installFoundryMock();
  try {
    const { actor } = makeActor();
    const sheet = await makeSheet(actor);
    const ctx = await sheet._prepareContext({});

    assert.equal(ctx.abilities.str.score, 16);
    assert.equal(ctx.abilities.str.modifier, '+3');
    assert.equal(ctx.abilities.str.savingThrow, '+5');
    assert.equal(ctx.abilities.str.saveProficient, true);
    assert.equal(ctx.abilities.dex.modifier, '+2');
    assert.equal(ctx.abilities.dex.savingThrow, '+2');
    assert.equal(ctx.abilities.dex.saveProficient, false);

    assert.deepEqual(ctx.skills.map((s) => s.name), ['acr', 'ath', 'ste']);
    assert.equal(ctx.skills[0].modifier, '+5');
    assert.equal(ctx.skills[0].proficient, true);
    assert.equal(ctx.skills[0].expertise, false);
    assert.equal(ctx.skills[1].proficient, false);
    assert.equal(ctx.skills[2].expertise, true);
    assert.equal(ctx.skills[2].ability, 'DEX');

    assert.deepEqual(ctx.combat.hitPoints, { current: 45, max: 50, temp: 3 });
    assert.equal(ctx.combat.armorClass, 17);
    assert.equal(ctx.combat.initiative, '+3');
    assert.equal(ctx.combat.speed, 30);
    assert.equal(ctx.combat.hitDice, '2 / 4');
    assert.equal(ctx.combat.proficiencyBonus, 3);
  } finally { restoreFoundryMock(previous); }
});

test('Sheet context builds spellcasting, equipment, features, and biography', async () => {
  const previous = installFoundryMock();
  try {
    const { actor } = makeActor();
    const sheet = await makeSheet(actor);
    const ctx = await sheet._prepareContext({});

    assert.equal(ctx.spellcasting.caster, true);
    assert.deepEqual(ctx.spellcasting.slots, [
      { level: 1, value: 2, max: 4 },
      { level: '1 Pact', value: 1, max: 2 }
    ]);
    assert.deepEqual(ctx.spellcasting.spells, [{ id: 'spell-1', name: 'Magic Missile', level: 1, prepared: false }]);

    assert.deepEqual(ctx.equipment.map((e) => e.name), ['Longsword', 'Rope', 'Thieves Tools']);
    assert.equal(ctx.equipment[0].equipped, true);
    assert.equal(ctx.equipment[1].quantity, 2);
    assert.equal(ctx.equipment[2].quantity, 1);

    assert.equal(ctx.features.race, 'Elf');
    assert.equal(ctx.features.background, 'Sailor');
    assert.deepEqual(ctx.features.classes, [{ name: 'Ranger', level: 5 }]);
    assert.equal(ctx.biography.personality, 'Brave');
    assert.equal(ctx.biography.backstory, 'Born in the north.');

    assert.equal(ctx.pages.length, 1);
    assert.equal(ctx.pages[0].id, 'main');
    assert.equal(ctx.pages[0].active, true);
    assert.equal(ctx.currentPageId, 'main');
    const types = ctx.widgets.map((w) => w.type).sort();
    assert.ok(types.includes('spells'));
    assert.ok(ctx.widgets.every((w) => w.colorStyle === '--widget-color: #7dd3fc;'));
    assert.ok(ctx.canvasSize.width >= 956);
    assert.ok(ctx.canvasSize.height >= 1176);
  } finally { restoreFoundryMock(previous); }
});

test('Non-caster sheets drop the spells widget and report caster false', async () => {
  const previous = installFoundryMock();
  try {
    const { actor } = makeActor({ spellItems: false, spellSlots: false });
    const sheet = await makeSheet(actor);
    const ctx = await sheet._prepareContext({});
    assert.equal(ctx.spellcasting.caster, false);
    assert.deepEqual(ctx.spellcasting.slots, []);
    assert.ok(!ctx.widgets.some((w) => w.type === 'spells'));
  } finally { restoreFoundryMock(previous); }
});

test('Saved layouts are respected and invalid page ids fall back to the first page', async () => {
  const previous = installFoundryMock();
  try {
    const saved = {
      version: 1,
      pages: [{ id: 'main', name: 'Main' }, { id: 'loot', name: 'Loot' }],
      widgets: [{ id: 'w1', type: 'skills', page: 'main', x: 16, y: 16, width: 440, height: 320, color: '#0ff' }]
    };
    const { actor } = makeActor({ layout: saved });
    const sheet = await makeSheet(actor);
    sheet.currentPageId = 'ghost';
    const ctx = await sheet._prepareContext({});
    assert.deepEqual(ctx.pages.map((p) => p.id), ['main', 'loot']);
    assert.equal(ctx.currentPageId, 'main');
    assert.ok(ctx.widgets.some((w) => w.id === 'w1' && w.colorStyle === '--widget-color: #0ff;'));
    const types = new Set(ctx.widgets.map((w) => w.type));
    for (const t of ['header', 'abilities', 'combat', 'equipment', 'features', 'biography']) {
      assert.ok(types.has(t), `missing ${t}`);
    }
  } finally { restoreFoundryMock(previous); }
});

test('Skill labels localize through CONFIG when available', async () => {
  const previous = installFoundryMock();
  try {
    globalThis.CONFIG = { DND5E: { skills: { acr: { label: 'DND5E.SkillAcr' } } } };
    const { actor } = makeActor();
    const sheet = await makeSheet(actor);
    const ctx = await sheet._prepareContext({});
    assert.equal(ctx.skills.find((s) => s.key === 'acr').name, 'DND5E.SkillAcr');
    assert.equal(ctx.skills.find((s) => s.key === 'ste').name, 'ste');
  } finally {
    delete globalThis.CONFIG;
    restoreFoundryMock(previous);
  }
});

test('Edit ability prompts, clamps at the dialog layer, and skips no-op updates', async () => {
  const previous = installFoundryMock();
  try {
    const { actor, updates } = makeActor();
    const sheet = await makeSheet(actor);
    const calls = stubDialog({ prompts: [18, null, 16] });

    await sheet.onEditAbility(null, el({ ability: 'str' }));
    await sheet.onEditAbility(null, el({ ability: 'str' }));
    await sheet.onEditAbility(null, el({ ability: 'str' }));
    assert.equal(calls.prompt[0].window.title, 'Edit Ability Score');
    assert.deepEqual(updates, [{ 'system.abilities.str.value': 18 }]);
  } finally { restoreFoundryMock(previous); }
});

test('Roll actions delegate to the actor with the right payloads', async () => {
  const previous = installFoundryMock();
  try {
    const { actor, rolls } = makeActor();
    const sheet = await makeSheet(actor);
    await sheet.onRollAbility(null, el({ ability: 'str' }));
    await sheet.onRollSkill(null, el({ skill: 'acr' }));
    await sheet.onRollSavingThrow(null, el({ ability: 'dex' }));
    await sheet.onRollHitDie(null, el({}));
    assert.deepEqual(rolls, [
      ['ability', { ability: 'str' }],
      ['skill', { skill: 'acr' }],
      ['save', { ability: 'dex' }],
      ['hitdie']
    ]);
  } finally { restoreFoundryMock(previous); }
});

test('Proficiency toggles cycle skills, saves, and spell preparation', async () => {
  const previous = installFoundryMock();
  try {
    const { actor, updates, spellItem } = makeActor();
    const sheet = await makeSheet(actor);

    await sheet.onToggleProficiency(null, el({ type: 'skill', key: 'ath' }));
    assert.deepEqual(updates.at(-1), { 'system.skills.ath.value': 1 });
    await sheet.onToggleProficiency(null, el({ type: 'skill', key: 'acr' }));
    assert.deepEqual(updates.at(-1), { 'system.skills.acr.value': 0 });

    await sheet.onToggleProficiency(null, el({ type: 'save', key: 'str' }));
    assert.deepEqual(updates.at(-1), { 'system.abilities.str.proficient': 0 });
    await sheet.onToggleProficiency(null, el({ type: 'save', key: 'con' }));
    assert.deepEqual(updates.at(-1), { 'system.abilities.con.proficient': 1 });

    await sheet.onToggleProficiency(null, el({ type: 'spellPrepared', key: 'spell-1' }));
    assert.deepEqual(spellItem.updates, [{ 'system.preparation.prepared': true }]);

    const before = updates.length;
    await sheet.onToggleProficiency(null, el({ type: 'spellPrepared', key: 'ghost' }));
    await sheet.onToggleProficiency(null, el({ type: 'unknown' }));
    assert.equal(updates.length, before);
  } finally { restoreFoundryMock(previous); }
});

test('Edit hit points persists non-null prompts and skips cancels', async () => {
  const previous = installFoundryMock();
  try {
    const { actor, updates } = makeActor();
    const sheet = await makeSheet(actor);
    const calls = stubDialog({ prompts: [40, null] });

    await sheet.onEditHitPoints(null, el({ type: 'current' }));
    await sheet.onEditHitPoints(null, el({ type: 'temp' }));
    assert.equal(calls.prompt[0].window.title, 'Edit Current HP');
    assert.deepEqual(updates, [{ 'system.attributes.hp.current': 40 }]);
  } finally { restoreFoundryMock(previous); }
});

test('Show artwork opens an ImagePopout for the actor image', async () => {
  const previous = installFoundryMock();
  try {
    const { actor } = makeActor();
    const sheet = await makeSheet(actor);
    let rendered = null;
    let received = null;
    globalThis.foundry.applications.apps.ImagePopout = class {
      constructor(opts) { received = opts; }
      render(v) { rendered = v; return this; }
    };
    await sheet.onShowArtwork();
    assert.equal(received.src, 'face.png');
    assert.equal(received.uuid, 'Actor.abc');
    assert.equal(rendered, true);
  } finally { restoreFoundryMock(previous); }
});

test('Render pass is safe in and out of edit mode with no canvas element', async () => {
  const previous = installFoundryMock();
  try {
    const { actor } = makeActor();
    const sheet = await makeSheet(actor);
    sheet._onRender({}, {});
    sheet.editMode = true;
    sheet._onRender({}, {});
    assert.ok(true);
  } finally { restoreFoundryMock(previous); }
});
