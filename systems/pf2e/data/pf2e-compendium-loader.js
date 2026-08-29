/**
 * Pf2eCompendiumLoader - Loads pf2e content (ancestries, heritages, backgrounds,
 * classes, feats, spells, equipment) from world items and compendia.
 * Built on the generic core/content-loader.js primitive, independent of
 * core/compendium-loader.js (dnd5e-shaped).
 */
import { ContentLoader } from '../../../core/content-loader.js';
import {
  AncestryTransformer,
  HeritageTransformer,
  BackgroundTransformer,
  ClassTransformer,
  FeatTransformer,
  SpellTransformer,
  EquipmentTransformer
} from './pf2e-content-transformers.js';

export class Pf2eCompendiumLoader {
  constructor() {
    this.loader = new ContentLoader();
    this.cache = {
      ancestries: [],
      heritages: [],
      backgrounds: [],
      classes: [],
      feats: { ancestry: [], class: [], skill: [], general: [], bonus: [] },
      spells: [],
      equipment: []
    };
    this._loaded = false;
  }

  async loadAllContent(enabledPacks = []) {
    const [ancestries, heritages, backgrounds, classes, feats, spells, weapons, armor, equipment] = await Promise.all([
      this.loader.getOrLoad('ancestry', enabledPacks, AncestryTransformer),
      this.loader.getOrLoad('heritage', enabledPacks, HeritageTransformer),
      this.loader.getOrLoad('background', enabledPacks, BackgroundTransformer),
      this.loader.getOrLoad('class', enabledPacks, ClassTransformer),
      this.loader.getOrLoad('feat', enabledPacks, FeatTransformer),
      this.loader.getOrLoad('spell', enabledPacks, SpellTransformer),
      this.loader.getOrLoad('weapon', enabledPacks, EquipmentTransformer),
      this.loader.getOrLoad('armor', enabledPacks, EquipmentTransformer),
      this.loader.getOrLoad('equipment', enabledPacks, EquipmentTransformer)
    ]);

    this.cache.ancestries = ancestries;
    this.cache.heritages = heritages;
    this.cache.backgrounds = backgrounds;
    this.cache.classes = classes;
    this.cache.feats = {
      ancestry: feats.filter((f) => f.category === 'ancestry'),
      class: feats.filter((f) => f.category === 'class'),
      skill: feats.filter((f) => f.category === 'skill'),
      general: feats.filter((f) => f.category === 'general'),
      bonus: feats.filter((f) => f.category === 'bonus')
    };
    this.cache.spells = spells;
    this.cache.equipment = [...weapons, ...armor, ...equipment];
    this._loaded = true;

    return this.cache;
  }

  async getOrLoadAll(enabledPacks = []) {
    if (!this._loaded) await this.loadAllContent(enabledPacks);
    return this.cache;
  }

  clearCache() {
    this.loader.clearCache();
    this._loaded = false;
  }
}
