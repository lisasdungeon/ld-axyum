/**
 * AxyumActionHandlers - navigation, selection, ability score, filter,
 * and create/save action handlers for AxyumApp.
 */

export const AxyumActionHandlers = (Base) => class extends Base {

  // ===== NAVIGATION HANDLERS =====

  async onNext(event) {
    this.navigation.nextPage();
    await this.render();
  }

  async onPrevious(event) {
    this.navigation.previousPage();
    await this.render();
  }

  // ===== SELECTION HANDLERS =====

  async onSelectClass(event, target) {
    target = this._actionEl(event, target);
    if (!target?.dataset) return;
    const classId = target.dataset.classId;

    const cls = this.availableOptions.classes.find((c) => c.id === classId);
    if (!cls) return;

    let startingEquipment = Array.isArray(cls.startingEquipment) ? cls.startingEquipment : [];
    if ((!startingEquipment.length) && cls.packName && cls.id) {
      try {
        const pack = game.packs?.get?.(cls.packName);
        const doc = await pack?.getDocument?.(cls.id);
        startingEquipment = doc?.system?.startingEquipment || [];
        cls.startingEquipment = startingEquipment;
      } catch (err) {
        console.warn('AxyumApp | Failed to load class startingEquipment', err);
      }
    }

    this.characterData.class = {
      id: cls.id,
      name: cls.name,
      level: 1,
      hitDie: cls.hitDie ? cls.hitDie.match(/\d+/)?.[0] || '8' : '8',
      source: cls.source || null,
      isHomebrew: !!cls.isHomebrew,
      packName: cls.packName || null,
      startingEquipment
    };
    this.characterData.startingPackageId = null;
    this.characterData.startingPackageChoices = {};
    this.characterData.selectedEquipmentIds = [];
    this.characterData.selectedCantrips = [];
    this.characterData.selectedSpells = [];
    this.characterData.skillProficiencies = [];

    const armorProfs = this._buildArmorProficiencies().filter((a) => a.granted).map((a) => a.id);
    const weaponProfs = this._buildWeaponProficiencies().filter((w) => w.granted).map((w) => w.id);
    this.characterData.proficiencies.armor = armorProfs;
    this.characterData.proficiencies.weapons = weaponProfs;
    this._updateDerivedStats();
    this.render();
  }

  onSelectRace(event, target) {
    target = this._actionEl(event, target);
    if (!target?.dataset) return;
    const raceId = target.dataset.raceId;

    const race = this.availableOptions.races.find(r => r.id === raceId);
    if (race) {
      this.characterData.race = {
        id: race.id,
        name: race.name,
        source: race.source || null,
        isHomebrew: !!race.isHomebrew,
        speed: race.movement?.walk || race.speed || 30
      };
      this.characterData.proficiencies.languages = this._getRaceLanguages();
      this._updateDerivedStats();
      this.render();
    }
  }

  onSelectBackground(event, target) {
    target = this._actionEl(event, target);
    if (!target?.dataset) return;
    const bgId = target.dataset.backgroundId;

    const bg = this.availableOptions.backgrounds.find(b => b.id === bgId);
    if (bg) {
      this.characterData.background = {
        id: bg.id,
        name: bg.name,
        source: bg.source || null,
        isHomebrew: !!bg.isHomebrew
      };
      const toolProfs = this._buildToolProficiencies().filter(t => t.granted).map(t => t.id);
      this.characterData.proficiencies.tools = toolProfs;
      this._updateDerivedStats();
      this.render();
    }
  }

  onSelectRole(event, target) {
    target = this._actionEl(event, target);
    if (!target?.dataset) return;
    const index = parseInt(target.dataset.roleIndex);
    this.filter.setSelectedRole(index);
    this.render();
  }

  // ===== ABILITY SCORE HANDLERS =====

  onRollAbility(event, target) {
    target = this._actionEl(event, target);
    if (target?.disabled || target?.hasAttribute?.('disabled')) return;
    const ability = target?.dataset?.ability;
    if (!ability) return;

    const result = this.abilityManager.rollSingleAbility(ability);
    if (!result.ok) {
      if (result.reason === 'use-reroll-all') {
        ui.notifications?.warn?.('Individual re-rolls are disabled. Use "Reroll All" once if you still have a reroll.');
      } else if (result.reason === 'limit') {
        ui.notifications?.warn?.('Reroll limit reached (1 / 1). Keep your current scores.');
      }
      return;
    }

    this.characterData.abilityMethod = 'roll';

    if (target) {
      target.style.opacity = '0';
      target.style.transition = 'opacity 0.2s';
      target.style.pointerEvents = 'none';
      const slot = target.closest('.roll-slot');
      if (slot) slot.classList.add('is-rolling');
    }

    this._animateDiceRoll(ability, result.roll);
  }

  _animateDiceRoll(ability, roll) {
    const container = this.element?.querySelector(`#dice-anim-${ability}`);
    if (container) {
      container.classList.add('show');
      const dice = container.querySelectorAll('.dice-tumble i');
      dice.forEach((die, i) => {
        die.className = 'fas fa-dice-d6';
        void die.offsetWidth;
        die.classList.add('rolling');
        setTimeout(() => {
          die.classList.remove('rolling');
          die.classList.add('landed');
        }, 400 + (i * 150));
      });
      setTimeout(() => { this.render(); }, 1200);
    } else {
      this.render();
    }
  }

  onRollAllAbilities(event, target) {
    target = this._actionEl(event, target);
    if (target?.disabled || target?.hasAttribute?.('disabled')) return;
    if (!this.abilityManager.canRoll()) {
      ui.notifications?.warn?.('Reroll limit reached (1 / 1). You must keep your current scores.');
      return;
    }
    const results = this.abilityManager.rollAllAbilityScores();
    if (!results.ok) {
      ui.notifications?.warn?.('Reroll limit reached (1 / 1). You must keep your current scores.');
      return;
    }

    this.characterData.abilities = {};
    this.characterData.abilityMethod = 'roll';

    if (results.rerollLimitReached) {
      ui.notifications?.info?.('Final roll used. Assign these scores — no further rerolls.');
    } else {
      ui.notifications?.info?.('Scores rolled. You may reroll all once, then you must keep them.');
    }

    this.render();
  }

  onUnassignScore(event, target) {
    target = this._actionEl(event, target);
    if (!target?.dataset) return;
    const ability = target.dataset.ability;
    const score = this.characterData.abilities[ability];

    if (score) {
      delete this.characterData.abilities[ability];
      if (this.abilityManager.assignedAbilities) delete this.abilityManager.assignedAbilities[ability];
      if (this.abilityManager.rolledPool) {
        this.abilityManager.rolledPool.push({ value: score, breakdown: 'Returned', assigned: false });
        this.abilityManager.rolledPool.sort((a, b) => b.value - a.value);
      }
      this.render();
    }
  }

  onAssignScore(event, target) {
    target = this._actionEl(event, target);
    if (!target?.dataset) return;
    const ability = target.dataset.ability;
    const score = parseInt(target.dataset.score);
    if (ability && !isNaN(score)) {
      this.characterData.abilities[ability] = score;
      this.abilityManager.assignScore(ability, score);
      this.render();
    }
  }

  onUseStandardArray(event, target) {
    const standardArray = [15, 14, 13, 12, 10, 8];
    this.abilityManager.rolledPool = standardArray.map((v) => ({ value: v, breakdown: 'Standard Array', assigned: false }));
    this.abilityManager.rolledScores = {};
    this.abilityManager.diceBreakdowns = {};
    this.characterData.abilities = {};
    this.characterData.abilityMethod = 'standard';
    this.render();
  }

  onUsePointBuy(event, target) {
    const abilities = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
    this.characterData.abilities = {};
    abilities.forEach(ab => { this.characterData.abilities[ab] = 8; });
    this.characterData.abilityMethod = 'pointbuy';
    this.abilityManager.rolledPool = null;
    this.abilityManager.rolledScores = {};
    this.abilityManager.diceBreakdowns = {};
    this.abilityManager.assignedAbilities = {};
    ui.notifications.info('Point Buy mode: all scores start at 8. Use + / - to spend your 27 points.');
    this.render();
  }

  onIncreaseAbilityScore(event, target) {
    target = this._actionEl(event, target);
    if (!target?.dataset) return;
    const ability = target.dataset.ability;
    if (!ability || this.characterData.abilityMethod !== 'pointbuy') return;

    const rules = this.abilityManager.getPointBuyRules();
    const current = this.characterData.abilities[ability] ?? rules.minScore;
    if (current >= rules.maxScore) return;

    const next = current + 1;
    const spent = Object.values(this.characterData.abilities).reduce((sum, v) => sum + (rules.costs[v] ?? 0), 0);
    const delta = (rules.costs[next] ?? 0) - (rules.costs[current] ?? 0);
    if (spent + delta > rules.pointsTotal) {
      ui.notifications?.warn?.('Not enough points remaining.');
      return;
    }
    this.characterData.abilities[ability] = next;
    this.render();
  }

  onDecreaseAbilityScore(event, target) {
    target = this._actionEl(event, target);
    if (!target?.dataset) return;
    const ability = target.dataset.ability;
    if (!ability || this.characterData.abilityMethod !== 'pointbuy') return;

    const rules = this.abilityManager.getPointBuyRules();
    const current = this.characterData.abilities[ability] ?? rules.minScore;
    if (current <= rules.minScore) return;
    this.characterData.abilities[ability] = current - 1;
    this.render();
  }

  onResetAbilities(event, target) {
    this.abilityManager.resetKeepRerollBudget();
    this.characterData.abilities = {};
    this.characterData.abilityMethod = null;
    ui.notifications.info('Scores cleared. Reroll budget is unchanged.');
    this.render();
  }

  onAssignScoreClick(event, target) {
    target = this._actionEl(event, target);
    if (!target?.dataset) return;
    const ability = target.dataset.ability;
    const pool = this.abilityManager.rolledPool;

    if (pool && pool.length > 0) {
      const unassigned = pool.find(s => !s.assigned);
      if (unassigned) {
        unassigned.assigned = true;
        this.characterData.abilities[ability] = unassigned.value;
        this.abilityManager.assignScore(ability, unassigned.value);
        this.render();
      }
    }
  }

  // ===== TRAIT ROLL HANDLER =====

  async onRollTrait(event, target) {
    if (!target) return;
    const trait = target.dataset.trait;
    const tableMap = {
      'details.traits': 'personality-traits',
      'details.ideals': 'ideals',
      'details.bonds': 'bonds',
      'details.flaws': 'flaws'
    };

    const tableName = tableMap[trait] || trait;
    if (!tableName) return;

    const result = await this.rollTables.rollOnTable(tableName);
    if (result) {
      const field = this.element.querySelector(`[name="${trait}"]`);
      if (field) {
        field.value = result;
        const parts = trait.split('.');
        let model = this.characterData;
        for (let i = 0; i < parts.length - 1; i++) model = model[parts[i]];
        model[parts[parts.length - 1]] = result;
      }
    }
  }

  // ===== FILTER HANDLERS =====

  onFilterCompendium(event, target) {
    const filterValue = target.dataset.filter || target.value;
    const type = target.classList.contains('race-compendium-filter-btn') ? 'race' : 'class';
    this.filter.setCompendiumFilter(type, filterValue);
    this.render();
  }

  onToggleHomebrew(event, target) {
    const input = target?.matches?.('input[type="checkbox"]')
      ? target
      : event?.target?.closest?.('label')?.querySelector?.('input[type="checkbox"]') || target;
    const checked = !!input?.checked;
    this.filter.setHomebrewVisibility(checked);
    this.render();
  }

  onFilterEquipment(event, target) {
    const button = target.closest?.('[data-filter]') || target;
    const filter = button?.dataset?.filter || '';
    this.currentEquipmentFilter = filter;
    this.render();
  }

  // ===== CREATE/SAVE HANDLERS =====

  async onCreate(event, target) {
    try {
      const nameInput = this.element?.querySelector('input[name="name"]');
      if (nameInput && nameInput.value && nameInput.value.trim()) {
        this.characterData.name = nameInput.value.trim();
      }

      const errors = [];
      if (!this.characterData.name?.trim()) errors.push('Character Name');
      if (!this.characterData.class?.id) errors.push('Class Selection');
      if (!this.characterData.race?.id) errors.push('Race Selection');
      if (!this.characterData.background?.id) errors.push('Background Selection');

      if (errors.length > 0) {
        ui.notifications.error(`Missing required fields: ${errors.join(', ')}`);
        return;
      }

      const rolledScores = this.abilityManager.getRolledScores();
      const assignedAbilities = this.abilityManager.getAssignedAbilities();
      const abilities = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

      for (const ab of abilities) {
        if (assignedAbilities[ab]) {
          this.characterData.abilities[ab] = assignedAbilities[ab];
        } else if (rolledScores[ab]) {
          this.characterData.abilities[ab] = rolledScores[ab];
        } else if (!this.characterData.abilities[ab]) {
          this.characterData.abilities[ab] = 10;
        }
      }

      this._updateDerivedStats();

      const actor = await this.creator.createCharacter(this.characterData);
      ui.notifications.info(`Character "${actor.name}" created successfully!`);
      this.close();
      if (actor?.sheet?.render) actor.sheet.render({ force: true });
    } catch (err) {
      console.error('LD Axyum | Character creation failed', err);
      ui.notifications.error(`Failed to create character: ${err.message}`);
    }
  }

  async onSave(event) {
    try {
      await this.creator.updateCharacter(this.actor, this.characterData);
      ui.notifications.info(`Character "${this.actor.name}" updated successfully!`);
      this.close();
    } catch (err) {
      console.error('LD Axyum | Character update failed', err);
      ui.notifications.error('Failed to update character');
    }
  }

  async onConfigureCompendia(event) {
    if (!game.user?.isGM) {
      ui.notifications.warn('Only the GM can configure compendia.');
      return;
    }
    const { CompendiumSelector } = await import('../ui/modals/compendium-selector.js');
    new CompendiumSelector().render({ force: true });
  }
};
