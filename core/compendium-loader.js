/**
 * LD Axyum - Compendium Loader
 * Handles loading and caching of content from dnd5e and module packs
 */
import { ContentLoader } from './content-loader.js';
import {
  ClassTransformer, RaceTransformer, BackgroundTransformer,
  SpellTransformer, EquipmentTransformer, FeatTransformer
} from './content-transformers.js';
import { CompendiumQueries } from './compendium-queries.js';
import { HomebrewLoader } from './homebrew-loader.js';
import { ContentSourceManager } from './content-source-manager.js';
import { CompendiumCacheManager } from './compendium-cache-manager.js';
import { logger } from './logger.js';

function emptyCache() {
  return {
    classes: null,
    races: null,
    backgrounds: null,
    spells: null,
    equipment: null,
    features: null,
    feats: null
  };
}

function isCachePopulated(cache) {
  return (
    Array.isArray(cache.classes) &&
    Array.isArray(cache.races) &&
    Array.isArray(cache.backgrounds) &&
    Array.isArray(cache.spells) &&
    Array.isArray(cache.equipment) &&
    Array.isArray(cache.feats)
  );
}

/** Treat all-empty caches as unloaded when packs exist (avoids sticky failure). */
function hasUsableContent(cache) {
  if (!isCachePopulated(cache)) return false;
  const total =
    (cache.classes?.length || 0) +
    (cache.races?.length || 0) +
    (cache.backgrounds?.length || 0) +
    (cache.spells?.length || 0) +
    (cache.equipment?.length || 0) +
    (cache.feats?.length || 0);
  if (total > 0) return true;
  // Empty world with no packs — consider loaded
  return !(game?.packs?.size > 0);
}

class CompendiumLoader {
  constructor() {
    this.cache = emptyCache();
    this.isLoading = false;
    this.loadPromise = null;
    this.homebrewDetected = false;
    this.homebrewPacks = [];
    this.worldFolders = new Map();
    this.folderConfig = new Map();
    this.contentSources = new Map();
    this.contentLoader = new ContentLoader();
    this.queries = new CompendiumQueries(this.cache, () => this.loadAllContent());
    this.homebrewLoader = new HomebrewLoader();
    this.sourceManager = new ContentSourceManager();
  }

  scanWorldFolders() { return this.sourceManager.scanWorldFolders(); }
  getAvailableFoldersForCategory(category) { return this.sourceManager.getAvailableFoldersForCategory(category); }
  getAllContentSources(category) { return this.sourceManager.getAllContentSources(category); }
  async loadContentSourceConfig() { return this.sourceManager.loadContentSourceConfig(); }
  saveContentSourceConfig(category, sources) {
    return this.sourceManager.saveContentSourceConfig(category, sources, (cat) => this.clearCacheForCategory(cat));
  }
  async loadFromSpecificSources(category, sources) { return this.sourceManager.loadFromSpecificSources(category, sources); }
  async _loadFromFolder(folderId, category) { return this.sourceManager.loadFromFolder(folderId, category); }
  async _loadFromCompendium(compendiumId, category) { return this.sourceManager.loadFromCompendium(compendiumId, category); }

  static detectHomebrewPacks() {
    try {
      if (!game?.packs) return [];
      const homebrewPacks = [];
      for (const pack of game.packs.values()) {
        if (String(pack.collection).includes('dnd5e')) continue;
        if (!pack.index || pack.index.size === 0 && pack.index.length === 0) continue;
        homebrewPacks.push({
          name: pack.collection,
          label: pack.title || pack.collection,
          source: this._extractModuleSource(pack.collection),
          itemCount: pack.index.size ?? pack.index.length ?? 0
        });
      }
      return homebrewPacks;
    } catch (err) {
      logger.warn('Failed to detect homebrew packs', err);
      return [];
    }
  }

  static _extractModuleSource(packCollection) {
    const parts = packCollection.split('.');
    if (parts.length > 0) return parts[0].replace(/-/g, ' ').toUpperCase();
    return 'HOMEBREW';
  }

  clearCacheForCategory(category) {
    CompendiumCacheManager.clearCacheForCategory(this.cache, category);
  }

  static getEnabledCompendia() {
    return CompendiumCacheManager.getEnabledCompendia();
  }

  async loadAllContent({ force = false } = {}) {
    if (this.isLoading && this.loadPromise) {
      return this.loadPromise;
    }

    if (!force && hasUsableContent(this.cache)) {
      return this.cache;
    }

    this.isLoading = true;
    this.loadPromise = this._performLoad();

    try {
      await this.loadPromise;
      this.isLoading = false;
      return this.cache;
    } catch (err) {
      logger.error('Failed to load content', err);
      this.isLoading = false;
      this.cache = {
        classes: [],
        races: [],
        backgrounds: [],
        spells: [],
        equipment: [],
        features: [],
        feats: []
      };
      // Do not sticky-resolve forever — allow retry on next open
      this.loadPromise = null;
      return this.cache;
    }
  }

  async _performLoad() {
    const transformers = {
      ClassTransformer, RaceTransformer, BackgroundTransformer,
      SpellTransformer, EquipmentTransformer, FeatTransformer
    };
    return CompendiumCacheManager.performLoad(this.contentLoader, this.cache, transformers);
  }

  async loadHomebrewContent() {
    const result = await this.homebrewLoader.loadHomebrewContent();
    this.homebrewDetected = result.detected;
    this.homebrewPacks = result.packs;
    return result;
  }

  async _loadHomebrewFromPack(packName) {
    return this.homebrewLoader.loadHomebrewFromPack(packName);
  }

  validateHomebrewContent(content) {
    return this.homebrewLoader.validateHomebrewContent(content);
  }

  mergeHomebrewContent(official, homebrew) {
    return this.homebrewLoader.mergeHomebrewContent(official, homebrew);
  }

  async getClasses(filter = '') { return this.queries.getClasses(filter); }
  async getClass(className) { return this.queries.getClass(className); }
  async getRaces(filter = '') { return this.queries.getRaces(filter); }
  async getRace(raceName) { return this.queries.getRace(raceName); }
  async getBackgrounds(filter = '') { return this.queries.getBackgrounds(filter); }
  async getBackground(bgName) { return this.queries.getBackground(bgName); }
  async getSpellsForClass(className, maxLevel = 9) { return this.queries.getSpellsForClass(className, maxLevel); }
  async getSpellsByLevel(level) { return this.queries.getSpellsByLevel(level); }
  async getCantrips(className = null) { return this.queries.getCantrips(className); }
  async getEquipment(type = null, filter = '') { return this.queries.getEquipment(type, filter); }
  async getWeapons(filter = '') { return this.queries.getWeapons(filter); }
  async getArmor(filter = '') { return this.queries.getArmor(filter); }
  async getFeats(filter = '') { return this.queries.getFeats(filter); }
  async getFeat(featName) { return this.queries.getFeat(featName); }
  async getFeatsByLevel(level, classes = null) { return this.queries.getFeatsByLevel(level, classes); }
  async getClassProgression(className) { return this.queries.getClassProgression(className); }
  async getMulticlassOptions() { return this.queries.getMulticlassOptions(); }

  async clearCache() {
    this.cache = emptyCache();
    this.isLoading = false;
    this.loadPromise = null;
    this.contentLoader.clearCache();
    return this.loadAllContent({ force: true });
  }

  getStats() {
    return {
      classes: this.cache.classes?.length || 0,
      races: this.cache.races?.length || 0,
      backgrounds: this.cache.backgrounds?.length || 0,
      spells: this.cache.spells?.length || 0,
      equipment: this.cache.equipment?.length || 0,
      feats: this.cache.feats?.length || 0
    };
  }

  validateMulticlass(classes) {
    if (!Array.isArray(classes) || classes.length === 0) {
      return { valid: false, message: 'Must select at least one class' };
    }
    const classIds = classes.map(c => c.id);
    const unique = new Set(classIds);
    if (unique.size !== classIds.length) {
      return { valid: false, message: 'Cannot have duplicate classes' };
    }
    return { valid: true, message: 'Valid multiclass combination' };
  }
}

export default CompendiumLoader;
