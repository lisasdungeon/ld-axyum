import assert from 'node:assert/strict';
import test from 'node:test';
import { installFoundryMock, restoreFoundryMock } from './foundry-mock.mjs';

function mockCalculatorSet() {
  return {
    AbilityCalculator: {
      getAbilityModifiers: (abilities) => ({
        str: Math.floor(((abilities?.str ?? 10) - 10) / 2),
        dex: Math.floor(((abilities?.dex ?? 10) - 10) / 2),
        con: Math.floor(((abilities?.con ?? 10) - 10) / 2),
        int: Math.floor(((abilities?.int ?? 10) - 10) / 2),
        wis: Math.floor(((abilities?.wis ?? 10) - 10) / 2),
        cha: Math.floor(((abilities?.cha ?? 10) - 10) / 2)
      }),
      getProficiencyBonus: (level) => 2 + Math.floor((Number(level) || 1 - 1) / 4)
    },
    CombatCalculator: {
      calculateHitPoints: ({ className, level, conModifier }) => 8 + conModifier * level,
      calculateArmorClass: ({ dexModifier, armorAC }) => armorAC + dexModifier,
      getHitDie: () => 'd8'
    },
    SpellcastingCalculator: {
      getSpellSlots: () => ({}),
      getCantripCount: () => 2,
      isSpellcaster: (className) => className === 'Wizard'
    },
    MulticlassCalculator: {
      isMulticlassSpellcaster: (classes, check) => classes.some((c) => check(c.name)),
      getMulticlassHP: (classes, conMod, getDie) => classes.reduce((s, c) => s + (c.level || 1) * (5 + conMod), 0),
      calculateMulticlassSpellSlots: () => ({ 1: 2 })
    }
  };
}

test('calculateAllDerivedStats branches: multiclass, spellcaster, and single-class paths', async () => {
  const previous = installFoundryMock();
  try {
    const { DerivedStatsCalculator } = await import('../core/derived-stats-calculator.js');
    const calcs = mockCalculatorSet();
    const character = {
      abilities: { str: 14, dex: 16, con: 12, int: 10, wis: 10, cha: 8 },
      class: { name: 'Ranger', level: 5 },
      skills: {},
      savingThrows: {}
    };

    const single = DerivedStatsCalculator.calculateAllDerivedStats(character, calcs);
    assert.equal(single.abilityModifiers.dex, 3);
    assert.equal(single.armorClass, 13);
    assert.equal(single.isSpellcaster, false);
    assert.equal(single.cantripCount, 2);
    assert.equal(single.maxSpellLevel, 3);

    const caster = DerivedStatsCalculator.calculateAllDerivedStats(
      { ...character, class: { name: 'Wizard', level: 5 } },
      calcs
    );
    assert.equal(caster.isSpellcaster, true);

    const multi = DerivedStatsCalculator.calculateAllDerivedStats({
      ...character,
      isMulticlass: true,
      classes: [
        { name: 'Wizard', level: 3 },
        { name: 'Fighter', level: 2 }
      ]
    }, calcs);
    assert.equal(multi.totalLevel, undefined);
    assert.equal(multi.proficiencyBonus, calcs.AbilityCalculator.getProficiencyBonus(5));
    assert.equal(multi.isSpellcaster, true);
    assert.equal(multi.cantripCount, 4);
    assert.deepEqual(multi.spellSlots, { 1: 2 });
    assert.equal(multi.hitPoints, 30);
    assert.equal(multi.maxSpellLevel, 3);

    const deadMulti = DerivedStatsCalculator.calculateAllDerivedStats({
      ...character,
      isMulticlass: true,
      classes: []
    }, calcs);
    assert.equal(deadMulti.hitPoints, 13);
  } finally { restoreFoundryMock(previous); }
});

test('calculateSkillBonus covers expertise over proficiency and otherBonus', async () => {
  const previous = installFoundryMock();
  try {
    const { DerivedStatsCalculator } = await import('../core/derived-stats-calculator.js');
    const base = { abilityModifier: 3, proficiencyBonus: 2 };
    assert.equal(DerivedStatsCalculator.calculateSkillBonus(base), 3);
    assert.equal(DerivedStatsCalculator.calculateSkillBonus({ ...base, proficient: true }), 5);
    assert.equal(DerivedStatsCalculator.calculateSkillBonus({ ...base, proficient: true, expertise: true }), 7);
    assert.equal(DerivedStatsCalculator.calculateSkillBonus({ ...base, expertise: true }), 7);
    assert.equal(DerivedStatsCalculator.calculateSkillBonus({ ...base, otherBonus: -1 }), 2);
  } finally { restoreFoundryMock(previous); }
});

test('calculateAllSkills handles missing skills, unknown abilities, and partial data', async () => {
  const previous = installFoundryMock();
  try {
    const { DerivedStatsCalculator } = await import('../core/derived-stats-calculator.js');
    const calcs = mockCalculatorSet();

    const none = DerivedStatsCalculator.calculateAllSkills({}, calcs);
    assert.equal(none.length, 18);
    assert.ok(none.every((s) => s.proficient === false && s.expertise === false && s.total === 0));

    const withSkills = DerivedStatsCalculator.calculateAllSkills({
      abilities: { dex: 16 },
      totalLevel: 5,
      skills: {
        acrobatics: { proficient: true },
        stealth: { expertise: true }
      }
    }, calcs);
    assert.equal(withSkills.find((s) => s.key === 'acrobatics').total, 6);
    assert.equal(withSkills.find((s) => s.key === 'acrobatics').ability, 'DEX');
    assert.equal(withSkills.find((s) => s.key === 'stealth').expertise, true);
    assert.equal(withSkills.find((s) => s.key === 'athletics').total, 0);
  } finally { restoreFoundryMock(previous); }
});

test('calculateSavingThrows covers proficiency, bonus, and fallback level paths', async () => {
  const previous = installFoundryMock();
  try {
    const { DerivedStatsCalculator } = await import('../core/derived-stats-calculator.js');
    const calcs = mockCalculatorSet();

    const out = DerivedStatsCalculator.calculateSavingThrows({
      abilities: { str: 14, dex: 10, con: 12 },
      savingThrows: {
        str: { proficient: true },
        con: { proficient: false, bonus: 2 }
      }
    }, calcs);
    assert.equal(out.find((s) => s.key === 'str').total, 4);
    assert.equal(out.find((s) => s.key === 'con').total, 3);
    assert.equal(out.find((s) => s.key === 'dex').total, 0);
    assert.equal(out.find((s) => s.key === 'cha').proficient, false);

    const noLevel = DerivedStatsCalculator.calculateSavingThrows({ abilities: {} }, calcs);
    assert.equal(noLevel.find((s) => s.key === 'str').total, 0);
  } finally { restoreFoundryMock(previous); }
});

test('Encumbrance thresholds follow the PHB 5x and 10x strength multipliers', async () => {  const previous = installFoundryMock();
  try {
    const { DerivedStatsCalculator } = await import('../core/derived-stats-calculator.js');

    const cap10 = DerivedStatsCalculator.checkEncumbrance(50, 10);
    assert.equal(cap10.encumbered, false);
    assert.equal(cap10.heavilyEncumbered, false);

    const over = DerivedStatsCalculator.checkEncumbrance(50.1, 10);
    assert.equal(over.encumbered, true);
    assert.equal(over.heavilyEncumbered, false);

    const heavy = DerivedStatsCalculator.checkEncumbrance(100.1, 10);
    assert.equal(heavy.heavilyEncumbered, true);

    const edge = DerivedStatsCalculator.checkEncumbrance(100, 10);
    assert.equal(edge.encumbered, true);
    assert.equal(edge.heavilyEncumbered, false);
  } finally { restoreFoundryMock(previous); }
});

test('getAbilityScoresArray defaults missing abilities to 10', async () => {
  const previous = installFoundryMock();
  try {
    const { DerivedStatsCalculator } = await import('../core/derived-stats-calculator.js');
    const calcs = mockCalculatorSet();
    const out = DerivedStatsCalculator.getAbilityScoresArray({ str: 15 }, calcs);
    assert.equal(out.length, 6);
    assert.equal(out.find((a) => a.key === 'str').score, 15);
    assert.equal(out.find((a) => a.key === 'cha').score, 10);
    assert.equal(out.find((a) => a.key === 'cha').modifier, 0);
  } finally { restoreFoundryMock(previous); }
});

test('detectHomebrewPacks filters system packs and empty packs, and survives errors', async () => {
  const previous = installFoundryMock();
  try {
    const { HomebrewLoader } = await import('../core/homebrew-loader.js');

    assert.deepEqual(HomebrewLoader.detectHomebrewPacks(), []);

    globalThis.game = { packs: null };
    assert.deepEqual(HomebrewLoader.detectHomebrewPacks(), []);

    const packs = {
      values: () => [
        { collection: 'dnd5e.classes', index: [1, 2], metadata: { label: 'Classes', type: 'Item' } },
        { collection: 'my-mod.spells', index: [1], metadata: { label: 'My Spells' } },
        { collection: 'empty.pack', index: [] },
        { collection: 'noindex.pack' },
        { collection: 'other.races', index: [1], metadata: {} }
      ]
    };
    globalThis.game = { packs };
    const detected = HomebrewLoader.detectHomebrewPacks();
    assert.deepEqual(detected.map((p) => p.name), ['my-mod.spells', 'other.races']);
    assert.equal(detected[0].label, 'My Spells');
    assert.equal(detected[0].type, 'Unknown');
    assert.equal(detected[0].hasContent, true);
    assert.equal(detected[1].label, 'other.races');

    globalThis.game = {
      get packs() { throw new Error('packs exploded'); }
    };
    assert.deepEqual(HomebrewLoader.detectHomebrewPacks(), []);
  } finally { restoreFoundryMock(previous); }
});

test('loadHomebrewFromPack maps every entry type with real pack stubs', async () => {
  const previous = installFoundryMock();
  try {
    const { HomebrewLoader } = await import('../core/homebrew-loader.js');
    const loader = new HomebrewLoader();

    assert.deepEqual(await loader.loadHomebrewFromPack('ghost.pack'), {
      classes: [], races: [], spells: [], feats: [], equipment: []
    });

    const index = [
      { _id: '1', name: 'Warlord', type: 'class', system: { hitDice: 'd10', spellcasting: { progression: 'half' } } },
      { _id: '2', name: 'Skyfolk', type: 'species', system: { advancement: { 1: { traits: [] } } } },
      { _id: '3', name: 'Ember', type: 'spell', system: { level: 3, school: 'evo', classes: ['wizard'] } },
      { _id: '4', name: 'Lucky', type: 'feat', system: { prerequisites: ['lvl4'], level: 4 } },
      { _id: '5', name: 'Sun Blade', type: 'weapon', system: { price: { value: 900 }, weight: { value: 3 }, rarity: 'rare' } },
      { _id: '6', name: 'Rope', type: 'equipment', system: {} },
      { _id: '7', name: 'Journal', type: 'loot', system: { price: { value: 5 } } },
      { _id: '8', name: 'Mystery', type: 'loot', system: {} }
    ];
    globalThis.game = {
      packs: {
        get: (name) => ({
          getIndex: async () => index,
          metadata: { label: 'My Mod' }
        })
      }
    };

    const content = await loader.loadHomebrewFromPack('my-mod.items');
    assert.equal(content.classes[0].hitDice, 'd10');
    assert.equal(content.classes[0].spellcasting, 'half');
    assert.equal(content.classes[0].source, 'My Mod');
    assert.equal(content.races[0].type, 'race');
    assert.ok(content.races[0].abilityBoosts);
    assert.equal(content.spells[0].level, 3);
    assert.equal(content.feats[0].requiresLevel, 4);
    const sunBlade = content.equipment.find((e) => e.name === 'Sun Blade');
    assert.equal(sunBlade.price, 900);
    assert.equal(sunBlade.weight, 3);
    assert.equal(sunBlade.rarity, 'rare');
    const rope = content.equipment.find((e) => e.name === 'Rope');
    assert.equal(rope.price, 0);
    assert.equal(rope.rarity, 'common');

    globalThis.game = {
      packs: {
        get: () => { throw new Error('pack exploded'); }
      }
    };
    const failed = await loader.loadHomebrewFromPack('bad.pack');
    assert.deepEqual(failed, { classes: [], races: [], spells: [], feats: [], equipment: [] });
  } finally { restoreFoundryMock(previous); }
});

test('loadHomebrewContent aggregates packs and degrades to empty when none or on error', async () => {
  const previous = installFoundryMock();
  try {
    const { HomebrewLoader } = await import('../core/homebrew-loader.js');
    const loader = new HomebrewLoader();

    globalThis.game = { packs: { values: () => [] } };
    const none = await loader.loadHomebrewContent();
    assert.equal(none.detected, false);
    assert.deepEqual(none.classes, []);

    const original = HomebrewLoader.detectHomebrewPacks;
    HomebrewLoader.detectHomebrewPacks = () => [{ name: 'mod.a' }, { name: 'mod.b' }];
    let calls = 0;
    loader.loadHomebrewFromPack = async () => {
      calls++;
      return { classes: [{ name: `C${calls}` }], races: [], spells: [], feats: [], equipment: [] };
    };
    const merged = await loader.loadHomebrewContent();
    assert.equal(calls, 2);
    assert.equal(merged.detected, true);
    assert.deepEqual(merged.classes.map((c) => c.name), ['C1', 'C2']);

    HomebrewLoader.detectHomebrewPacks = () => { throw new Error('boom'); };
    const broken = await loader.loadHomebrewContent();
    assert.equal(broken.detected, false);
    assert.deepEqual(broken.packs, []);
    HomebrewLoader.detectHomebrewPacks = original;
  } finally { restoreFoundryMock(previous); }
});

test('validateHomebrewContent reports every rule violation with context', async () => {
  const previous = installFoundryMock();
  try {
    const { HomebrewLoader } = await import('../core/homebrew-loader.js');
    const loader = new HomebrewLoader();

    assert.deepEqual(loader.validateHomebrewContent({}), { valid: true, errors: [] });

    const out = loader.validateHomebrewContent({
      classes: [{ name: 'Ok' }, { hitDice: 'd8' }, {}, { name: 'NoDice' }],
      races: [{}],
      spells: [{ level: 1 }, {}, { name: 'NoLevel' }],
      feats: [{}]
    });
    assert.equal(out.valid, false);
    assert.ok(out.errors.includes('Class missing name'));
    assert.ok(out.errors.includes('Class undefined missing hitDice'));
    assert.ok(out.errors.includes('Class Ok missing hitDice'));
    assert.ok(out.errors.includes('Class NoDice missing hitDice'));
    assert.ok(out.errors.includes('Race missing name'));
    assert.ok(out.errors.includes('Spell undefined missing level'));
    assert.ok(out.errors.includes('Spell NoLevel missing level'));
    assert.ok(out.errors.includes('Feat missing name'));
  } finally { restoreFoundryMock(previous); }
});

test('mergeHomebrewContent dedups official-first, sorts, and falls back on error', async () => {
  const previous = installFoundryMock();
  try {
    const { HomebrewLoader } = await import('../core/homebrew-loader.js');
    const loader = new HomebrewLoader();

    const official = {
      classes: [{ name: 'Wizard', isHomebrew: false }, { name: 'Fighter', isHomebrew: false }],
      races: [], spells: [], feats: [],
      equipment: [{ name: 'Rope', isHomebrew: false }]
    };
    const homebrew = {
      classes: [{ name: 'Fighter (HB)', isHomebrew: true }, { name: 'Wizard', isHomebrew: true }],
      races: [{ name: 'Skyfolk', isHomebrew: true }],
      spells: [{ name: 'Ember', isHomebrew: true }],
      feats: [{ name: 'Lucky', isHomebrew: true }],
      equipment: [{ name: 'Rope', isHomebrew: true }, { name: 'Anvil', isHomebrew: true }]
    };

    const merged = loader.mergeHomebrewContent(official, homebrew);
    assert.deepEqual(merged.classes.map((c) => c.name), ['Fighter', 'Wizard', 'Fighter (HB)']);
    assert.deepEqual(merged.races.map((r) => r.name), ['Skyfolk']);
    assert.deepEqual(merged.equipment.map((e) => e.name), ['Rope', 'Anvil']);

    const broken = loader.mergeHomebrewContent(null, homebrew);
    assert.equal(broken, null);
  } finally { restoreFoundryMock(previous); }
});

test('mergeAndDedup sorts the non-source branch alphabetically', async () => {
  const previous = installFoundryMock();
  try {
    const { HomebrewLoader } = await import('../core/homebrew-loader.js');
    const loader = new HomebrewLoader();
    const merged = loader._mergeAndDedup(
      [{ name: 'Zebra' }, { name: 'Apple' }],
      [{ name: 'Mango' }],
      'name',
      false
    );
    assert.deepEqual(merged.map((i) => i.name), ['Apple', 'Mango', 'Zebra']);
  } finally { restoreFoundryMock(previous); }
});
