/**
 * PF2eProficiencyCalculator - Core proficiency rank math shared by every
 * pf2e derived stat (skills, saves, perception, class DC, AC, spell DC/attack).
 */

export const PF2E_PROFICIENCY_RANKS = ['untrained', 'trained', 'expert', 'master', 'legendary'];

// Foundry pf2e's default tier bonuses (also the "Proficiency without Level" variant's defaults)
const RANK_BONUS = [0, 2, 4, 6, 8];

export class Pf2eProficiencyCalculator {
  /**
   * Normalize a rank (name or index) to its 0-4 index.
   * @param {string|number} rank
   * @returns {number}
   */
  static normalizeRank(rank) {
    if (typeof rank === 'number') return Math.max(0, Math.min(4, Math.floor(rank)));
    const idx = PF2E_PROFICIENCY_RANKS.indexOf(String(rank || 'untrained').toLowerCase());
    return idx === -1 ? 0 : idx;
  }

  /**
   * Get the flat tier bonus for a proficiency rank (before any level addition).
   * @param {string|number} rank
   * @returns {number}
   */
  static getRankBonus(rank) {
    return RANK_BONUS[this.normalizeRank(rank)];
  }

  /**
   * Compute a full proficiency bonus: tier bonus + character level (unless
   * untrained, or unless the "Proficiency without Level" variant is active).
   * @param {string|number} rank
   * @param {number} level - Character level
   * @param {Object} [options]
   * @param {boolean} [options.proficiencyWithoutLevel=false]
   * @returns {number}
   */
  static getProficiencyBonus(rank, level, options = {}) {
    const rankIndex = this.normalizeRank(rank);
    const tierBonus = RANK_BONUS[rankIndex];
    const withoutLevel = !!options.proficiencyWithoutLevel;
    if (withoutLevel || rankIndex === 0) return tierBonus;
    return tierBonus + (Number(level) || 0);
  }

  /**
   * Get the display label for a rank.
   * @param {string|number} rank
   * @returns {string}
   */
  static getRankLabel(rank) {
    const idx = this.normalizeRank(rank);
    const label = PF2E_PROFICIENCY_RANKS[idx];
    return label.charAt(0).toUpperCase() + label.slice(1);
  }
}
