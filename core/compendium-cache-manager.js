/**
 * Compendium Cache Manager
 * Manages loading orchestration and caching for compendium content
 */

import { logger } from './logger.js';
import { itemPriority } from './content-loader.js';

export class CompendiumCacheManager {
  static clearCacheForCategory(cache, category) {
    switch (category) {
      case 'classes':
        cache.classes = null;
        break;
      case 'races':
        cache.races = null;
        break;
      case 'backgrounds':
        cache.backgrounds = null;
        break;
      case 'feats':
        cache.feats = null;
        break;
      case 'spells':
        cache.spells = null;
        break;
      case 'equipment':
        cache.equipment = null;
        break;
    }
  }

  /**
   * Get enabled compendia from settings.
   * Empty result = permissive mode (caller loads all packs).
   */
  static getEnabledCompendia() {
    let settings;
    try {
      settings = game.settings.get('ld-axyum', 'enabledCompendia');
    } catch (err) {
      logger.warn('Could not read enabledCompendia setting:', err.message);
      return [];
    }

    if (Array.isArray(settings)) {
      return settings.filter(Boolean);
    }

    const enabledMap = settings || {};
    return Object.entries(enabledMap)
      .filter(([, isEnabled]) => isEnabled)
      .map(([packId]) => packId);
  }

  /** Always include official book Item packs when present in the world. */
  static getOfficialBookPacks() {
    if (!game?.packs) return [];
    const prefer = [
      /^dnd-players-handbook\./i,
      /^dnd-tashas-cauldron\./i,
      /^dnd-dungeon-masters-guide\./i,
      /^dnd5e\.(classes|classes24|races|origins24|backgrounds|spells|spells24|feats|feats24|items|equipment24)/i
    ];
    const nonItem = new Set(['Actor', 'JournalEntry', 'RollTable', 'Macro', 'Playlist', 'Scene', 'Adventure', 'Cards']);
    return Array.from(game.packs)
      .filter((pack) => {
        const docName = pack?.documentName || pack?.metadata?.documentName || pack?.metadata?.type;
        if (nonItem.has(docName)) return false;
        return prefer.some((re) => re.test(pack.collection));
      })
      .map((pack) => pack.collection);
  }

  static async performLoad(contentLoader, cache, transformers) {
    let enabled = this.getEnabledCompendia();
    const official = this.getOfficialBookPacks();

    // Permissive default: load from every Item pack when nothing is configured.
    // Only exclude packs positively identified as non-Item — never exclude on an
    // unrecognized/empty docName, or a Foundry API quirk silently empties the wizard.
    if (enabled.length === 0 && game?.packs) {
      const nonItem = new Set(['Actor', 'JournalEntry', 'RollTable', 'Macro', 'Playlist', 'Scene', 'Adventure', 'Cards']);
      enabled = Array.from(game.packs)
        .filter((pack) => {
          const docName = pack?.documentName || pack?.metadata?.documentName || pack?.metadata?.type;
          return !nonItem.has(docName);
        })
        .map((pack) => pack.collection);
    } else if (enabled.length > 0 && official.length > 0) {
      // Settings may have been saved before books were installed — merge them in
      enabled = Array.from(new Set([...enabled, ...official]));
    }

    logger.log('performLoad starting', {
      enabledCount: enabled.length,
      availablePacks: game?.packs?.size || 0
    });

    if (enabled.length === 0) {
      logger.warn('No Item compendia available to load.');
    }

    const loadType = async (type, transformer) => {
      let items = await contentLoader.loadItemType(type, enabled, transformer);
      // If a filtered pack list yields nothing, fall back to every Item pack
      if ((!items || items.length === 0) && enabled.length > 0) {
        logger.warn(`${type} empty with enabled filter — scanning all Item packs`);
        items = await contentLoader.loadItemType(type, [], transformer);
      }
      return items || [];
    };

    try {
      const [classes, races, backgrounds, spells, feats, ...equipmentChunks] = await Promise.all([
        loadType('class', transformers.ClassTransformer.transform),
        loadType('race', transformers.RaceTransformer.transform),
        loadType('background', transformers.BackgroundTransformer.transform),
        loadType('spell', transformers.SpellTransformer.transform),
        loadType('feat', transformers.FeatTransformer.transform),
        loadType('equipment', transformers.EquipmentTransformer.transform),
        loadType('weapon', transformers.EquipmentTransformer.transform),
        loadType('tool', transformers.EquipmentTransformer.transform),
        loadType('consumable', transformers.EquipmentTransformer.transform)
      ]);

      const bestEquip = new Map();
      for (const item of equipmentChunks.flat()) {
        const key = (item?.name || '').toLowerCase().trim();
        if (!key) continue;
        const prev = bestEquip.get(key);
        if (!prev || itemPriority(item) > itemPriority(prev)) bestEquip.set(key, item);
      }
      const equipment = Array.from(bestEquip.values());

      cache.classes = classes || [];
      cache.races = races || [];
      cache.backgrounds = backgrounds || [];
      cache.spells = spells || [];
      cache.equipment = equipment;
      cache.feats = feats || [];
      cache.features = cache.features || [];

      logger.log('All content loaded', {
        classes: cache.classes.length,
        races: cache.races.length,
        backgrounds: cache.backgrounds.length,
        spells: cache.spells.length,
        equipment: cache.equipment.length,
        feats: cache.feats.length
      });

      return cache;
    } catch (err) {
      logger.error('Load error', err);
      throw err;
    }
  }
}

export default CompendiumCacheManager;
