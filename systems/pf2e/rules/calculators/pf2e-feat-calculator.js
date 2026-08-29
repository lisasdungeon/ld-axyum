/**
 * Pf2eFeatCalculator - Feat slot progression for PF2e's four feat categories.
 */

const ANCESTRY_LEVELS = [1, 5, 9, 13, 17];
const GENERAL_LEVELS = [3, 7, 11, 15, 19];
// Class feats: 1st level and every even level thereafter
// Skill feats: every even level starting at 2nd
const isClassFeatLevel = (lvl) => lvl === 1 || (lvl % 2 === 0);
const isSkillFeatLevel = (lvl) => lvl % 2 === 0;

export class Pf2eFeatCalculator {
  /**
   * Get the cumulative number of feat slots unlocked in each category by a given level.
   * @param {number} level
   * @returns {{ancestry:number, class:number, skill:number, general:number}}
   */
  static getFeatSlotsAtLevel(level) {
    const lvl = Math.max(1, Math.min(20, Math.floor(Number(level) || 1)));
    const counts = { ancestry: 0, class: 0, skill: 0, general: 0 };

    for (let l = 1; l <= lvl; l++) {
      if (ANCESTRY_LEVELS.includes(l)) counts.ancestry++;
      if (GENERAL_LEVELS.includes(l)) counts.general++;
      if (isClassFeatLevel(l)) counts.class++;
      if (isSkillFeatLevel(l)) counts.skill++;
    }

    return counts;
  }

  /**
   * Get just the feat-category slots newly unlocked at exactly this level.
   * @param {number} level
   * @returns {{ancestry:boolean, class:boolean, skill:boolean, general:boolean}}
   */
  static getFeatSlotsGrantedAtLevel(level) {
    const lvl = Math.max(1, Math.min(20, Math.floor(Number(level) || 1)));
    return {
      ancestry: ANCESTRY_LEVELS.includes(lvl),
      class: isClassFeatLevel(lvl),
      skill: isSkillFeatLevel(lvl),
      general: GENERAL_LEVELS.includes(lvl)
    };
  }

  /**
   * Best-effort prerequisite check: only validates the feat's stated level
   * requirement (full free-text prerequisite parsing is out of scope).
   * @param {Object} feat - { level, prerequisites }
   * @param {Object} characterData - { totalLevel }
   * @returns {{valid: boolean, message: string}}
   */
  static validateFeatPrerequisites(feat, characterData) {
    const requiredLevel = Number(feat?.level) || 1;
    const characterLevel = Number(characterData?.totalLevel ?? characterData?.level) || 1;
    if (characterLevel < requiredLevel) {
      return { valid: false, message: `Requires level ${requiredLevel}` };
    }
    return { valid: true, message: '' };
  }
}
