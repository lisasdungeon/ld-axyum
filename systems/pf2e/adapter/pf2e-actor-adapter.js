/**
 * Pf2eActorAdapter - Creates/updates a Foundry pf2e Actor from Axyum pf2e
 * wizard character data, and creates the backing embedded Items.
 *
 * Schema paths below marked "confirmed" were verified against the installed
 * pf2e system's source (v8.4.1). Paths marked "verify" are best-effort and
 * should be checked against a live actor (`actor.system` in the console)
 * before relying on them — Foundry silently drops unknown data-model paths
 * rather than erroring, so a wrong guess here fails quietly, not loudly.
 */
import { Pf2eAbilityBoostCalculator } from '../rules/calculators/pf2e-ability-boost-calculator.js';
import { Pf2eRulesEngine } from '../rules/pf2e-rules-engine.js';

const SAVE_ABILITY = { fortitude: 'con', reflex: 'dex', will: 'wis' };

export class Pf2eActorAdapter {
  static async createActor(characterData, contentCache = {}) {
    const system = this._convertToFoundryFormat(characterData);

    const actor = await Actor.create({
      name: characterData.name || 'New Character',
      type: 'character',
      img: characterData.details?.portrait || 'icons/svg/mystery-man.svg',
      system,
      flags: { 'ld-axyum': { createdBy: 'pf2e-wizard' } }
    });

    if (!actor) throw new Error('Actor.create returned null');

    await this._createEmbeddedItems(actor, characterData, contentCache);
    return actor;
  }

  static async updateActor(actor, characterData, contentCache = {}) {
    const system = this._convertToFoundryFormat(characterData);
    await actor.update({ system });
    await this._createEmbeddedItems(actor, characterData, contentCache, { replace: true });
    return actor;
  }

  /**
   * Build the actor's `system` field from wizard character data.
   * @private
   */
  static _convertToFoundryFormat(characterData) {
    const boosts = characterData.abilityBoosts || {};
    const finalAbilities = Pf2eAbilityBoostCalculator.computeFinalAbilities({
      ancestryBoosts: boosts.ancestry,
      ancestryFlaws: characterData.ancestry?.flaws,
      backgroundBoost: boosts.background,
      classBoost: boosts.class,
      freeBoosts: boosts.free
    });
    const mods = Pf2eAbilityBoostCalculator.getModifiers(finalAbilities);
    const level = characterData.level || 1;
    const pwol = !!characterData.proficiencyWithoutLevel;
    const profs = characterData.proficiencies || {};

    // confirmed: system.abilities.{key}.mod (PCs store only the modifier)
    const abilities = {};
    for (const key of Object.keys(mods)) abilities[key] = { mod: mods[key] };

    // confirmed: system.saves.{key} = {rank, attribute}
    const saves = {};
    for (const [key, ability] of Object.entries(SAVE_ABILITY)) {
      saves[key] = { rank: this._rankIndex(profs.saves?.[key]), attribute: ability };
    }

    // confirmed: system.skills[slug] = {rank, ...} (source data; lore skills are separate items)
    const skills = {};
    for (const [slug, rank] of Object.entries(profs.skills || {})) {
      skills[slug] = { rank: this._rankIndex(rank) };
    }

    const hp = Pf2eRulesEngine.calculateHP({
      ancestryHP: characterData.ancestry?.hp || 0,
      classHPPerLevel: characterData.class?.hpPerLevel || 8,
      level,
      conModifier: mods.con
    });

    return {
      abilities,
      saves,
      skills,
      // confirmed: system.attributes.hp = {value, max, temp}
      attributes: {
        hp: { value: hp, max: hp, temp: 0 },
        // verify: perception rank storage location moved around across pf2e versions
        perception: { rank: this._rankIndex(profs.perception) }
      },
      // verify: class DC proficiency storage (single vs. per-class-slug map)
      proficiencies: {
        classDCs: { [characterData.class?.id || 'class']: { rank: this._rankIndex(profs.classDC) } }
      },
      details: {
        level: { value: level },
        heritage: { name: characterData.heritage?.name || '' },
        biography: { value: characterData.details?.backstory || '' },
        languages: { value: characterData.languages || [] }
      }
    };
  }

  static _rankIndex(rank) {
    const ranks = ['untrained', 'trained', 'expert', 'master', 'legendary'];
    const idx = ranks.indexOf(String(rank || 'untrained').toLowerCase());
    return idx === -1 ? 0 : idx;
  }

  /**
   * Create embedded Items for ancestry/heritage/background/class/feats/spells/equipment.
   * @private
   */
  static async _createEmbeddedItems(actor, characterData, contentCache, options = {}) {
    const itemsToCreate = [];

    const fetchDoc = async (id, packName) => {
      if (!id) return null;
      try {
        if (!packName || packName === 'world') return game.items?.get(id) || null;
        const pack = game.packs?.get(packName);
        return pack ? await pack.getDocument(id) : null;
      } catch (err) {
        console.warn('Pf2eActorAdapter | Failed to fetch item', id, err);
        return null;
      }
    };

    const toItemData = (doc) => {
      if (!doc) return null;
      const data = doc.toObject();
      delete data._id;
      return data;
    };

    const findInCache = (list, id) => (list || []).find((entry) => entry.id === id);

    if (options.replace) {
      const staleTypes = ['ancestry', 'heritage', 'background', 'class'];
      const stale = actor.items.filter((i) => staleTypes.includes(i.type)).map((i) => i.id);
      if (stale.length) await actor.deleteEmbeddedDocuments('Item', stale);
    }

    const singleSelections = [
      ['ancestry', characterData.ancestry?.id, contentCache.ancestries],
      ['heritage', characterData.heritage?.id, contentCache.heritages],
      ['background', characterData.background?.id, contentCache.backgrounds],
      ['class', characterData.class?.id, contentCache.classes]
    ];
    for (const [, id, list] of singleSelections) {
      const entry = findInCache(list, id);
      if (!entry) continue;
      const doc = await fetchDoc(entry.id, entry.packName);
      const data = toItemData(doc);
      if (data) itemsToCreate.push(data);
    }

    const feats = characterData.feats || {};
    const allFeatIds = [...(feats.ancestry || []), ...(feats.class || []), ...(feats.skill || []), ...(feats.general || [])];
    for (const id of allFeatIds) {
      const entry = Object.values(contentCache.feats || {}).flat().find((f) => f.id === id);
      if (!entry) continue;
      const data = toItemData(await fetchDoc(entry.id, entry.packName));
      if (data) itemsToCreate.push(data);
    }

    const spellIds = [
      ...(characterData.spells?.selectedCantrips || []),
      ...Object.values(characterData.spells?.selectedSpells || {}).flat()
    ];
    for (const id of spellIds) {
      const entry = findInCache(contentCache.spells, id);
      if (!entry) continue;
      const data = toItemData(await fetchDoc(entry.id, entry.packName));
      if (data) itemsToCreate.push(data);
    }

    for (const id of characterData.equipment?.selectedIds || []) {
      const entry = findInCache(contentCache.equipment, id);
      if (!entry) continue;
      const data = toItemData(await fetchDoc(entry.id, entry.packName));
      if (data) itemsToCreate.push(data);
    }

    if (itemsToCreate.length > 0) {
      await actor.createEmbeddedDocuments('Item', itemsToCreate);
    }
  }
}
