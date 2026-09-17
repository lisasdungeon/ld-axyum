import assert from 'node:assert/strict';
import test from 'node:test';

/**
 * Regression tests for Foundry inline-enricher and link-ref stripping.
 * Raw compendium descriptions contain dnd5e 4.x / SRD 5.2 enricher syntax
 * ([[lookup @...]]{label}, [[/r 1d6]], @Check[...], @Damage[...]) which must
 * not leak into wizard card blurbs. Human-readable {labels} are kept.
 */

test('dnd5e feat blurbs strip SRD 5.2 enrichers but keep their labels', async () => {
  const { FeatTransformer } = await import('../core/content-transformers.js');

  const feat = FeatTransformer.transform({
    id: 'f1', name: 'Abduct',
    system: {
      description: { value: "<p>The [[lookup @name.lowercase]]{monster} needn't spend extra movement to move a creature it is grappling.</p>" }
    }
  }, 'dnd5e.feats');
  assert.equal(feat.blurb, "The monster needn't spend extra movement to move a creature it is grappling.");
});

test('dnd5e blurbs drop enrichers with no label and clean up punctuation', async () => {
  const { FeatTransformer } = await import('../core/content-transformers.js');

  const feat = FeatTransformer.transform({
    id: 'f2', name: 'Acid Breath',
    system: {
      description: { value: '<p>Dexterity Saving Throw: DC [[lookup @save.dc.value activity=qN16W02jZCUQbPpYE]], each creature in the line.</p>' }
    }
  }, 'dnd5e.feats');
  assert.equal(feat.blurb, 'Dexterity Saving Throw: DC, each creature in the line.');
});

test('dnd5e blurbs strip @Check/@Damage/@Save link refs and roll formulas', async () => {
  const { FeatTransformer, SpellTransformer } = await import('../core/content-transformers.js');

  const feat = FeatTransformer.transform({
    id: 'f3', name: 'Acid Absorption',
    system: {
      description: { value: '<p>Whenever the [[lookup @name.lowercase]]{monster} is subjected to acid damage, it takes no damage and regains hit points equal to the amount of @damage[acid] dealt.</p>' }
    }
  }, 'dnd5e.feats');
  assert.ok(!feat.blurb.includes('@damage'), `@damage leaked: ${feat.blurb}`);
  assert.ok(!feat.blurb.includes('[['), `enricher leaked: ${feat.blurb}`);
  assert.ok(feat.blurb.includes('monster is subjected to acid damage'));

  const spell = SpellTransformer.transform({
    id: 's1', name: 'Acid Arrow',
    system: {
      level: 2, school: 'evo',
      description: { value: '<p>A shimmering arrow. Make a ranged spell attack: [[/r 4d4]] damage on a hit, and @check[type:ranged-spell] against the target.</p>' }
    }
  }, 'dnd5e.spells');
  assert.ok(!spell.description.includes('[[/r'), `roll enricher leaked: ${spell.description}`);
  assert.ok(!spell.description.includes('@check'), `@check leaked: ${spell.description}`);
});

test('dnd5e blurbs strip @UUID/@Compendium/@Embed links and html', async () => {
  const { FeatTransformer } = await import('../core/content-transformers.js');

  const feat = FeatTransformer.transform({
    id: 'f4', name: 'Extra Attack',
    system: {
      description: { value: '<p>See @UUID[Compendium.dnd5e.rules.JournalEntry]{Extra Attack} and @Compendium[dnd5e.rules.Xyz]{Rule} plus @Embed[Actor.abc]{Thing}.</p>' }
    }
  }, 'dnd5e.feats');
  assert.equal(feat.blurb, 'See and plus.');
});

test('pf2e descriptions strip enrichers and link refs the same way', async () => {
  const { FeatTransformer: Pf2eFeat, SpellTransformer: Pf2eSpell } = await import('../systems/pf2e/data/pf2e-content-transformers.js');

  const feat = Pf2eFeat({
    id: 'p1', name: 'Elf Atavism',
    system: { description: { value: '<p>You have @Check[type:flat|dc:15] a [[/r 1d6]] @damage[2d6] and a @UUID[Compendium.pf2e.feats.Xyz]{Echoing Evil}.</p>' } }
  }, 'pf2e.feats');
  assert.ok(!feat.description.includes('@'), `@ref leaked: ${feat.description}`);
  assert.ok(!feat.description.includes('[['), `enricher leaked: ${feat.description}`);

  const spell = Pf2eSpell({
    id: 'p2', name: 'Acid Arrow',
    system: {
      rank: { value: 2 },
      traits: { value: [], traditions: ['arcane'] },
      description: { value: '<p>[[lookup @item.name]]{The arrow} deals [[/r 3d6]] @damage[3d6,persistent] damage.</p>' }
    }
  }, 'pf2e.spells-srd');
  assert.ok(!spell.description.includes('[['), `enricher leaked: ${spell.description}`);
  assert.ok(!spell.description.includes('@damage'), `@damage leaked: ${spell.description}`);
  assert.ok(!spell.description.includes('@UUID'), `@UUID leaked: ${spell.description}`);
  assert.ok(spell.description.includes('The arrow'));
});
