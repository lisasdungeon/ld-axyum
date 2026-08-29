/**
 * Pf2eCompendiumQueries - Query helpers over a loaded Pf2eCompendiumLoader cache.
 */

export class Pf2eCompendiumQueries {
  /**
   * @param {Object} cache - A Pf2eCompendiumLoader.cache object
   */
  constructor(cache) {
    this.cache = cache || {};
  }

  getAncestries() {
    return this.cache.ancestries || [];
  }

  getHeritagesForAncestry(ancestryId) {
    const ancestry = (this.cache.ancestries || []).find((a) => a.id === ancestryId);
    const heritages = this.cache.heritages || [];
    if (!ancestry) return heritages;
    // Heritage/ancestry linkage in pf2e data is loose (slug-based); fall back to
    // showing all heritages if none are specifically tagged for this ancestry.
    const matched = heritages.filter((h) => h.ancestryId && ancestry.name &&
      String(h.ancestryId).toLowerCase() === String(ancestry.name).toLowerCase());
    return matched.length > 0 ? matched : heritages;
  }

  getBackgrounds() {
    return this.cache.backgrounds || [];
  }

  getClasses() {
    return this.cache.classes || [];
  }

  getFeatsByCategory(category, level = 20) {
    const list = this.cache.feats?.[category] || [];
    return list.filter((f) => (Number(f.level) || 1) <= level);
  }

  getSpellsForTradition(tradition, maxRank = 10) {
    const spells = this.cache.spells || [];
    return spells.filter((s) => {
      const withinRank = (s.rank ?? 0) <= maxRank;
      const matchesTradition = !tradition || !s.traditions?.length || s.traditions.includes(tradition);
      return withinRank && matchesTradition;
    });
  }

  getCantrips(tradition) {
    return this.getSpellsForTradition(tradition, 0).filter((s) => (s.rank ?? 0) === 0);
  }

  getEquipment() {
    return this.cache.equipment || [];
  }
}
