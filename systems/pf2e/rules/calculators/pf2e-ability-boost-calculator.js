/**
 * Pf2eAbilityBoostCalculator - PF2e ability boost/flaw math and validation.
 * PF2e characters start every ability at 10 and apply boosts (+2, or +1 if
 * already 18+) and flaws (-2) from ancestry, background, class, and 4 free
 * choices, rather than assigning point-buy/rolled scores directly.
 */

const ABILITY_KEYS = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
const FREE_BOOST_COUNT = 4;

export class Pf2eAbilityBoostCalculator {
  /**
   * Apply a single boost to a score.
   * @param {number} score
   * @returns {number}
   */
  static applyBoost(score) {
    return score >= 18 ? score + 1 : score + 2;
  }

  /**
   * Apply a single flaw to a score.
   * @param {number} score
   * @returns {number}
   */
  static applyFlaw(score) {
    return Math.max(8, score - 2);
  }

  /**
   * Get an ability modifier from a final score.
   * @param {number} score
   * @returns {number}
   */
  static getModifier(score) {
    return Math.floor((Number(score ?? 10) - 10) / 2);
  }

  /**
   * Validate that free boosts don't repeat an ability (PF2e rule: at most
   * one free boost per ability among the free slots).
   * @param {string[]} freeBoosts - Array of ability keys, up to FREE_BOOST_COUNT
   * @returns {{valid: boolean, errors: string[]}}
   */
  static validateFreeBoosts(freeBoosts) {
    const errors = [];
    const list = Array.isArray(freeBoosts) ? freeBoosts.filter(Boolean) : [];

    if (list.length > FREE_BOOST_COUNT) {
      errors.push(`Only ${FREE_BOOST_COUNT} free ability boosts are allowed`);
    }

    const seen = new Set();
    for (const key of list) {
      if (seen.has(key)) {
        errors.push(`Cannot apply more than one free boost to the same ability (${key.toUpperCase()})`);
      }
      seen.add(key);
    }

    for (const key of list) {
      if (!ABILITY_KEYS.includes(key)) {
        errors.push(`Unknown ability key: ${key}`);
      }
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Compute final ability scores from base 10s plus every boost/flaw source,
   * applied in PF2e's defined order: ancestry boosts+flaws, background boost,
   * class boost, then the 4 free boosts.
   * @param {Object} options
   * @param {string[]} [options.ancestryBoosts]
   * @param {string[]} [options.ancestryFlaws]
   * @param {string} [options.backgroundBoost]
   * @param {string} [options.classBoost]
   * @param {string[]} [options.freeBoosts]
   * @returns {Object} Final ability scores { str, dex, con, int, wis, cha }
   */
  static computeFinalAbilities(options = {}) {
    const scores = {};
    for (const key of ABILITY_KEYS) scores[key] = 10;

    const applyBoostTo = (key) => {
      if (key && scores[key] !== undefined) scores[key] = this.applyBoost(scores[key]);
    };
    const applyFlawTo = (key) => {
      if (key && scores[key] !== undefined) scores[key] = this.applyFlaw(scores[key]);
    };

    (options.ancestryBoosts || []).forEach(applyBoostTo);
    (options.ancestryFlaws || []).forEach(applyFlawTo);
    applyBoostTo(options.backgroundBoost);
    applyBoostTo(options.classBoost);
    (options.freeBoosts || []).forEach(applyBoostTo);

    return scores;
  }

  /**
   * Get ability modifiers for a full set of final scores.
   * @param {Object} abilities - { str, dex, con, int, wis, cha }
   * @returns {Object} Modifiers keyed the same way
   */
  static getModifiers(abilities) {
    const mods = {};
    for (const key of ABILITY_KEYS) {
      mods[key] = this.getModifier(abilities?.[key] ?? 10);
    }
    return mods;
  }

  static get FREE_BOOST_COUNT() {
    return FREE_BOOST_COUNT;
  }

  static get ABILITY_KEYS() {
    return [...ABILITY_KEYS];
  }
}
