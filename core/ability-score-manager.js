/**
 * AbilityScoreManager - ability score rolling / assignment
 *
 * Roll budget (strict):
 *  - Set 1: first Roll All, OR finishing all 6 individual rolls
 *  - Set 2: one Roll All reroll only
 *  - After set 2: hard lock (no more dice)
 * Clear Assignments does not refund the budget.
 */
export class AbilityScoreManager {
  constructor() {
    this.rolledScores = {};
    this.diceBreakdowns = {};
    this.assignedAbilities = {};
    this.rolledPool = null;
    /** Completed full roll sets: 0 none, 1 initial, 2 reroll used */
    this.fullSetsCompleted = 0;
  }

  get hasRolled() { return this.fullSetsCompleted >= 1; }
  get hasRerolled() { return this.fullSetsCompleted >= 2; }

  rollAbilityScore() {
    const rolls = [];
    for (let i = 0; i < 4; i++) rolls.push(Math.floor(Math.random() * 6) + 1);
    rolls.sort((a, b) => b - a);
    const kept = rolls.slice(0, 3);
    return {
      total: kept.reduce((sum, val) => sum + val, 0),
      breakdown: rolls.join(', '),
      kept,
      dropped: rolls[3]
    };
  }

  canRoll() {
    return this.fullSetsCompleted < 2;
  }

  canReroll() {
    return this.fullSetsCompleted === 1;
  }

  hasRolledOnce() {
    return this.fullSetsCompleted >= 1;
  }

  getRerollStatus() {
    const rerollsUsed = Math.max(0, this.fullSetsCompleted - 1);
    return {
      hasRolled: this.hasRolled,
      hasRerolled: this.hasRerolled,
      canRoll: this.canRoll(),
      canReroll: this.canReroll(),
      fullSetsCompleted: this.fullSetsCompleted,
      rerollsUsed: Math.min(1, rerollsUsed),
      rerollsRemaining: this.fullSetsCompleted >= 2 ? 0 : (this.fullSetsCompleted === 1 ? 1 : 1),
      label: `Rerolls used: ${Math.min(1, rerollsUsed)} / 1`,
      locked: this.fullSetsCompleted >= 2
    };
  }

  _keys() {
    return ['str', 'dex', 'con', 'int', 'wis', 'cha'];
  }

  _allFilled() {
    return this._keys().every((k) => this.rolledScores[k] != null);
  }

  _markSetComplete() {
    if (this.fullSetsCompleted < 2) this.fullSetsCompleted += 1;
  }

  /**
   * Fill one empty ability. Blocked after the first full set (use Roll All to reroll).
   */
  rollSingleAbility(ability) {
    if (!ability) return { ok: false, reason: 'missing-ability' };

    if (this.fullSetsCompleted >= 2) {
      return { ok: false, reason: 'limit', status: this.getRerollStatus() };
    }

    if (this.fullSetsCompleted >= 1) {
      return { ok: false, reason: 'use-reroll-all', status: this.getRerollStatus() };
    }

    if (this.rolledScores[ability] != null) {
      return { ok: false, reason: 'use-reroll-all', status: this.getRerollStatus() };
    }

    const roll = this.rollAbilityScore();
    this.rolledScores[ability] = roll.total;
    this.diceBreakdowns[ability] = roll.breakdown;

    if (this._allFilled()) this._markSetComplete();

    return { ok: true, roll, status: this.getRerollStatus() };
  }

  rollAllAbilityScores() {
    if (this.fullSetsCompleted >= 2) {
      return {
        ok: false,
        scores: this.rolledScores,
        breakdowns: this.diceBreakdowns,
        status: this.getRerollStatus()
      };
    }

    const results = {};
    const breakdowns = {};
    this._keys().forEach((ability) => {
      const roll = this.rollAbilityScore();
      results[ability] = roll.total;
      breakdowns[ability] = roll.breakdown;
    });

    this.rolledScores = results;
    this.diceBreakdowns = breakdowns;
    this.rolledPool = null;
    this._markSetComplete();

    return {
      ok: true,
      scores: results,
      breakdowns,
      rerollLimitReached: this.fullSetsCompleted >= 2,
      status: this.getRerollStatus()
    };
  }

  rollPoolScores(count = 6) {
    if (this.fullSetsCompleted >= 2) {
      return { ok: false, pool: this.rolledPool, status: this.getRerollStatus() };
    }

    const pool = [];
    for (let i = 0; i < count; i++) {
      const roll = this.rollAbilityScore();
      pool.push({ value: roll.total, breakdown: roll.breakdown, assigned: false });
    }

    this.rolledPool = pool.sort((a, b) => b.value - a.value);
    this.rolledScores = {};
    this.diceBreakdowns = {};
    this._markSetComplete();
    return { ok: true, pool: this.rolledPool, status: this.getRerollStatus() };
  }

  assignScore(ability, score) { this.assignedAbilities[ability] = score; }
  getAssignedScore(ability) { return this.assignedAbilities[ability] || null; }

  clearAssignments() {
    this.assignedAbilities = {};
    if (this.rolledPool) this.rolledPool.forEach((s) => { s.assigned = false; });
  }

  isScoreAssigned(score) {
    return Object.values(this.assignedAbilities).includes(score);
  }

  getUnassignedScores() {
    if (!this.rolledPool) return [];
    return this.rolledPool.filter((score) => !score.assigned);
  }

  validateStandardArray(scores) {
    const standardArray = [15, 14, 13, 12, 10, 8];
    const sortedScores = Object.values(scores).sort((a, b) => b - a);
    return JSON.stringify(sortedScores) === JSON.stringify(standardArray);
  }

  validatePointBuy(scores) {
    const costs = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 };
    let totalCost = 0;
    for (const score of Object.values(scores)) {
      if (score < 8 || score > 15) return false;
      totalCost += costs[score];
    }
    return totalCost === 27;
  }

  calculateModifier(score) { return Math.floor((score - 10) / 2); }

  getAbilityModifiers(scores) {
    const modifiers = {};
    for (const [ability, score] of Object.entries(scores)) {
      modifiers[ability] = this.calculateModifier(score);
    }
    return modifiers;
  }

  getStandardArrayScores() {
    return { options: [15, 14, 13, 12, 10, 8], description: 'Assign these scores to your abilities' };
  }

  getPointBuyRules() {
    return {
      pointsTotal: 27, minScore: 8, maxScore: 15,
      costs: { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 }
    };
  }

  getRolledScores() { return this.rolledScores; }
  getDiceBreakdowns() { return this.diceBreakdowns; }
  getAssignedAbilities() { return this.assignedAbilities; }
  getRolledPool() { return this.rolledPool; }

  /** Clear scores/assignments but keep roll budget spent. */
  resetKeepRerollBudget() {
    const sets = this.fullSetsCompleted;
    this.rolledScores = {};
    this.diceBreakdowns = {};
    this.assignedAbilities = {};
    this.rolledPool = null;
    this.fullSetsCompleted = sets;
  }

  reset() {
    this.resetKeepRerollBudget();
  }
}
