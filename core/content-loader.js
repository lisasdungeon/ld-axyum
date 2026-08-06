/**
 * Content Loader Helper - Pulls item data from Foundry pack indexes
 */

import { logger } from './logger.js';

const INDEX_FIELDS = {
  class: ['system.hitDice', 'system.hp', 'system.spellcasting', 'system.saves', 'system.skills', 'system.source', 'system.startingEquipment', 'system.description', 'system.primaryAbility'],
  race: ['system.advancement', 'system.traits', 'system.movement', 'system.source', 'system.description'],
  species: ['system.advancement', 'system.traits', 'system.movement', 'system.source', 'system.description'],
  background: ['system.skills', 'system.languages', 'system.startingEquipment', 'system.advancement', 'system.source', 'system.description'],
  spell: ['system.level', 'system.school', 'system.components', 'system.properties', 'system.source', 'system.description'],
  equipment: ['system.type', 'system.rarity', 'system.weight', 'system.price', 'system.source', 'system.description'],
  weapon: ['system.type', 'system.rarity', 'system.weight', 'system.price', 'system.source', 'system.description'],
  tool: ['system.type', 'system.rarity', 'system.weight', 'system.price', 'system.source', 'system.description'],
  consumable: ['system.type', 'system.rarity', 'system.weight', 'system.price', 'system.source', 'system.description'],
  feat: ['system.requirements', 'system.type', 'system.source', 'system.description', 'system.prerequisites']
};

/** Higher wins when the same class/race name appears in multiple packs. */
const SOURCE_PRIORITY = {
  PHB: 100,
  'PHB 2024': 98,
  "Tasha's": 90,
  TCE: 90,
  DMG: 80,
  MM: 70,
  'Free Rules': 55,
  'SRD 5.2': 45,
  'SRD 5.1': 40,
  SRD: 35,
  World: 10
};

const PACK_PRIORITY = [
  { test: /dnd-players-handbook/i, rank: 100, label: 'PHB' },
  { test: /players-handbook|phb/i, rank: 95, label: 'PHB' },
  { test: /tasha|tcoe/i, rank: 90, label: "Tasha's" },
  { test: /dungeon-masters|dmg/i, rank: 80, label: 'DMG' },
  { test: /monster-manual|\.mm\b/i, rank: 70, label: 'MM' },
  { test: /classes24|origins24|content24|spells24|equipment24|feats24/i, rank: 60, label: 'PHB 2024' },
  { test: /dnd5e|srd|free-rules|freerules/i, rank: 30, label: 'SRD' },
  { test: /^world$/i, rank: 10, label: 'World' }
];

const NON_ITEM_DOCUMENT_TYPES = new Set(['Actor', 'JournalEntry', 'RollTable', 'Macro', 'Playlist', 'Scene', 'Adventure', 'Cards']);

/** Only exclude packs positively identified as non-Item — never exclude on an unrecognized/empty value. */
function isItemPack(pack) {
  const docName = pack?.documentName || pack?.metadata?.documentName || pack?.metadata?.type;
  return !NON_ITEM_DOCUMENT_TYPES.has(docName);
}

function packRank(packName) {
  const name = String(packName || '');
  for (const rule of PACK_PRIORITY) {
    if (rule.test.test(name)) return rule.rank;
  }
  return 20;
}

function sourceRank(source) {
  const s = String(source || '');
  for (const [key, rank] of Object.entries(SOURCE_PRIORITY)) {
    if (s === key || s.includes(key)) return rank;
  }
  return 15;
}

function itemPriority(item) {
  return Math.max(sourceRank(item?.source), packRank(item?.packName));
}

function extractSource(packName, metadata, system = null) {
  const book =
    system?.source?.book ||
    system?.source?.custom ||
    metadata?.flags?.dnd5e?.sourceBook ||
    metadata?.flags?.dnd5e?.source ||
    null;

  if (book) {
    const b = String(book).trim();
    if (/tasha|tce/i.test(b)) return "Tasha's";
    if (/phb|player.?s handbook/i.test(b)) return /2024/.test(b) ? 'PHB 2024' : 'PHB';
    if (/dmg|dungeon.?master/i.test(b)) return 'DMG';
    if (/srd/i.test(b)) return b.includes('5.2') ? 'SRD 5.2' : (b.includes('5.1') ? 'SRD 5.1' : 'SRD');
    return b;
  }

  if (packName === 'world') return 'World';

  const lower = String(packName || '').toLowerCase();
  for (const rule of PACK_PRIORITY) {
    if (rule.test.test(lower)) return rule.label;
  }
  return packName.replace(/^[^\.]+\./, '').replace(/-/g, ' ').toUpperCase() || 'Unknown';
}

function isHomebrewSource(packName, source) {
  if (packName === 'world') return true;
  const s = String(source || '');
  const official = ['SRD', 'PHB', 'Free Rules', 'MM', 'DMG', "Tasha's", 'TCE', 'D&D 5e'];
  return !official.some((o) => s.includes(o));
}

async function readPackIndex(pack, fields) {
  try {
    return await pack.getIndex({ fields: ['type', ...fields] });
  } catch (err) {
    logger.warn(`getIndex with fields failed for ${pack.collection}, retrying bare index`, err);
    try {
      return await pack.getIndex({ fields: ['type'] });
    } catch (err2) {
      logger.warn(`Bare getIndex failed for ${pack.collection}`, err2);
      return null;
    }
  }
}

export class ContentLoader {
  constructor() {
    this.cache = new Map();
    this._inflight = new Map();
  }

  async loadItemType(itemType, enabledPacks = [], transformer = null) {
    const types = itemType === 'race' ? ['race', 'species'] : [itemType];
    const items = [];
    const fields = INDEX_FIELDS[types[0]] || [];

    if (game?.items) {
      for (const item of game.items) {
        if (!types.includes(item.type)) continue;
        try {
          const transformed = transformer
            ? transformer(item, 'world')
            : this._defaultTransform(item, 'world');
          if (transformed) items.push(transformed);
        } catch (err) {
          logger.warn(`Failed to transform world item ${item.name}`, err);
        }
      }
    }

    if (game?.packs) {
      // Prefer higher-priority packs first so first-seen dedupe keeps PHB/Tasha
      const packs = Array.from(game.packs)
        .filter(isItemPack)
        .sort((a, b) => packRank(b.collection) - packRank(a.collection));

      for (const pack of packs) {
        if (enabledPacks.length > 0 && !enabledPacks.includes(pack.collection)) continue;

        const index = await readPackIndex(pack, fields);
        if (!index) continue;
        const metadata = pack.metadata || {};

        for (const entry of index) {
          if (!types.includes(entry.type)) continue;

          const proxy = {
            id: entry._id,
            name: entry.name,
            type: entry.type === 'species' ? 'race' : entry.type,
            img: entry.img,
            system: entry.system || {}
          };

          try {
            const transformed = transformer
              ? transformer(proxy, pack.collection, metadata)
              : this._defaultTransform(proxy, pack.collection, metadata);
            if (transformed) items.push(transformed);
          } catch (err) {
            logger.warn(`Failed to transform ${entry.name} from ${pack.collection}`, err);
          }
        }
      }
    }

    return this._deduplicateAndSort(items);
  }

  _defaultTransform(item, packName, metadata = null) {
    const source = extractSource(packName, metadata, item.system);
    return {
      id: item.id,
      packName,
      name: item.name,
      type: item.type === 'species' ? 'race' : item.type,
      source,
      isHomebrew: isHomebrewSource(packName, source),
      system: item.system
    };
  }

  _deduplicateAndSort(items) {
    const best = new Map();
    for (const item of items) {
      const key = (item.name || '').toLowerCase().trim();
      if (!key) continue;
      const prev = best.get(key);
      if (!prev || itemPriority(item) > itemPriority(prev)) {
        best.set(key, item);
      }
    }
    return Array.from(best.values()).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }

  async getOrLoad(itemType, enabledPacks = [], transformer = null, forceReload = false) {
    const cacheKey = `${itemType}:${enabledPacks.join(',')}`;
    if (!forceReload && this.cache.has(cacheKey)) return this.cache.get(cacheKey);
    if (!forceReload && this._inflight.has(cacheKey)) return this._inflight.get(cacheKey);

    const promise = this.loadItemType(itemType, enabledPacks, transformer)
      .then((items) => {
        this.cache.set(cacheKey, items);
        this._inflight.delete(cacheKey);
        return items;
      })
      .catch((err) => {
        this._inflight.delete(cacheKey);
        throw err;
      });

    this._inflight.set(cacheKey, promise);
    return promise;
  }

  clearCache() {
    this.cache.clear();
    this._inflight.clear();
  }

  clearCacheFor(itemType) {
    for (const key of this.cache.keys()) {
      if (key.startsWith(`${itemType}:`)) this.cache.delete(key);
    }
  }
}

export { extractSource, isHomebrewSource, isItemPack, itemPriority, packRank };
