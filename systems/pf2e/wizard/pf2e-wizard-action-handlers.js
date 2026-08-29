/**
 * Pf2eWizardActionHandlers - navigation, selection, and creation handlers
 * for Pf2eWizardApp. Mirrors the role of core/axyum-action-handlers.js.
 */
import { Pf2eActorAdapter } from '../adapter/pf2e-actor-adapter.js';
import { Pf2eCharacterModel } from '../data/pf2e-character-model.js';
import { Pf2eAbilityBoostCalculator } from '../rules/calculators/pf2e-ability-boost-calculator.js';

export const Pf2eWizardActionHandlers = (Base) => class extends Base {

  // ===== NAVIGATION =====

  async onNext(event) {
    this.navigation.nextPage();
    this._skipSpellsPageIfNonCaster(1);
    await this.render();
  }

  async onPrevious(event) {
    this.navigation.previousPage();
    this._skipSpellsPageIfNonCaster(-1);
    await this.render();
  }

  _skipSpellsPageIfNonCaster(direction) {
    if (this.navigation.getCurrentPage() === 'spells' && !this._isSpellcaster()) {
      if (direction >= 0) this.navigation.nextPage();
      else this.navigation.previousPage();
    }
  }

  async onToggleProficiencyWithoutLevel(event) {
    this.characterData.proficiencyWithoutLevel = !this.characterData.proficiencyWithoutLevel;
    await this.render();
  }

  // ===== SELECTION =====

  async onSelectAncestry(event, target) {
    target = this._actionEl(event, target);
    const ancestryId = target?.dataset?.ancestryId;
    const ancestry = (this.queries?.getAncestries() || []).find((a) => a.id === ancestryId);
    if (!ancestry) return;
    this.characterData.ancestry = { id: ancestry.id, name: ancestry.name, hp: ancestry.hp, size: ancestry.size, speed: ancestry.speed, traits: ancestry.traits, boosts: ancestry.boosts, flaws: ancestry.flaws };
    this.characterData.abilityBoosts.ancestry = ancestry.boosts.filter((b) => b !== 'free');
    await this.render();
  }

  async onSelectHeritage(event, target) {
    target = this._actionEl(event, target);
    const heritageId = target?.dataset?.heritageId;
    const heritage = (this.queries?.getHeritagesForAncestry(this.characterData.ancestry?.id) || []).find((h) => h.id === heritageId);
    if (!heritage) return;
    this.characterData.heritage = { id: heritage.id, name: heritage.name };
    await this.render();
  }

  async onSelectBackground(event, target) {
    target = this._actionEl(event, target);
    const backgroundId = target?.dataset?.backgroundId;
    const background = (this.queries?.getBackgrounds() || []).find((b) => b.id === backgroundId);
    if (!background) return;
    this.characterData.background = { id: background.id, name: background.name, boosts: background.boosts, trainedSkill: background.trainedSkill, loreSkill: background.loreSkill };
    this.characterData.abilityBoosts.background = background.boosts?.[0] || '';
    if (background.trainedSkill) {
      this.characterData.proficiencies.skills[background.trainedSkill] = 'trained';
    }
    await this.render();
  }

  async onSelectClass(event, target) {
    target = this._actionEl(event, target);
    const classId = target?.dataset?.classId;
    const cls = (this.queries?.getClasses() || []).find((c) => c.id === classId);
    if (!cls) return;
    this.characterData.class = {
      id: cls.id, name: cls.name, keyAbility: cls.keyAbility, keyAbilityOptions: cls.keyAbilityOptions,
      hpPerLevel: cls.hpPerLevel, spellcasting: cls.spellcasting
    };
    this.characterData.abilityBoosts.class = cls.keyAbility || '';
    this.characterData.proficiencies.classDC = 'trained';
    await this.render();
  }

  async onSelectKeyAbility(event, target) {
    target = this._actionEl(event, target);
    const ability = target?.dataset?.ability;
    if (!ability) return;
    this.characterData.class.keyAbility = ability;
    this.characterData.abilityBoosts.class = ability;
    await this.render();
  }

  // ===== ABILITY BOOSTS =====

  async onAssignBoost(event, target) {
    target = this._actionEl(event, target);
    const ability = target?.dataset?.ability;
    const slot = Number(target?.dataset?.slot);
    if (!ability || !Number.isInteger(slot)) return;

    const free = this.characterData.abilityBoosts.free;
    const withoutThisSlot = free.filter((_, idx) => idx !== slot);
    const validation = Pf2eAbilityBoostCalculator.validateFreeBoosts([...withoutThisSlot, ability]);
    if (!validation.valid) {
      ui.notifications?.warn?.(validation.errors[0]);
      return;
    }
    free[slot] = ability;
    await this.render();
  }

  async onRemoveBoost(event, target) {
    target = this._actionEl(event, target);
    const slot = Number(target?.dataset?.slot);
    if (!Number.isInteger(slot)) return;
    this.characterData.abilityBoosts.free[slot] = '';
    await this.render();
  }

  // ===== SKILLS =====

  async onToggleSkillTraining(event, target) {
    target = this._actionEl(event, target);
    const slug = target?.dataset?.skill;
    const rank = target?.dataset?.rank;
    if (!slug || !rank) return;
    this.characterData.proficiencies.skills[slug] = rank;
    await this.render();
  }

  // ===== FEATS =====

  async onToggleFeat(event, target) {
    target = this._actionEl(event, target);
    const category = target?.dataset?.category;
    const featId = target?.dataset?.featId;
    if (!category || !featId) return;
    const list = this.characterData.feats[category] || (this.characterData.feats[category] = []);
    const idx = list.indexOf(featId);
    if (idx === -1) list.push(featId); else list.splice(idx, 1);
    await this.render();
  }

  // ===== SPELLS =====

  async onToggleSpell(event, target) {
    target = this._actionEl(event, target);
    const spellId = target?.dataset?.spellId;
    const isCantrip = target?.dataset?.cantrip === 'true';
    if (!spellId) return;
    if (isCantrip) {
      const list = this.characterData.spells.selectedCantrips;
      const idx = list.indexOf(spellId);
      if (idx === -1) list.push(spellId); else list.splice(idx, 1);
    } else {
      const rank = target?.dataset?.rank || '1';
      const bucket = this.characterData.spells.selectedSpells[rank] || (this.characterData.spells.selectedSpells[rank] = []);
      const idx = bucket.indexOf(spellId);
      if (idx === -1) bucket.push(spellId); else bucket.splice(idx, 1);
    }
    await this.render();
  }

  // ===== EQUIPMENT =====

  async onToggleEquipment(event, target) {
    target = this._actionEl(event, target);
    const itemId = target?.dataset?.itemId;
    if (!itemId) return;
    const list = this.characterData.equipment.selectedIds;
    const idx = list.indexOf(itemId);
    if (idx === -1) list.push(itemId); else list.splice(idx, 1);
    await this.render();
  }

  // ===== CREATE / SAVE =====

  async onCreate(event) {
    try {
      const normalized = Pf2eCharacterModel.normalize(this.characterData);
      const validation = Pf2eCharacterModel.validate(normalized);
      if (!validation.valid) {
        ui.notifications?.warn?.(validation.errors.join(', '));
        return;
      }
      const actor = await Pf2eActorAdapter.createActor(normalized, this.compendium?.cache || {});
      ui.notifications?.info?.(`Created ${actor.name}`);
      await this.close();
    } catch (err) {
      console.error('Pf2eWizardApp | Character creation failed', err);
      ui.notifications?.error?.('Failed to create character: ' + err.message);
    }
  }

  async onSave(event) {
    if (!this.actor) return this.onCreate(event);
    try {
      const normalized = Pf2eCharacterModel.normalize(this.characterData);
      await Pf2eActorAdapter.updateActor(this.actor, normalized, this.compendium?.cache || {});
      ui.notifications?.info?.(`Updated ${this.actor.name}`);
    } catch (err) {
      console.error('Pf2eWizardApp | Character update failed', err);
      ui.notifications?.error?.('Failed to update character: ' + err.message);
    }
  }
};
