/**
 * AxyumActionHandlersChoices - equipment package, skill, feat,
 * proficiency, form-input, and drag/drop handlers for AxyumApp.
 */
import { resolveSelectedPackageItems } from './starting-equipment.js';

export const AxyumActionHandlersChoices = (Base) => class extends Base {

  // ===== STARTING EQUIPMENT HANDLERS =====

  onToggleEquipment() {
    ui.notifications?.info?.('Use the class starting packages on this page.');
  }

  onSelectStartingPackage(event, target) {
    target = this._actionEl(event, target);
    const packageId = target?.dataset?.packageId;
    if (!packageId) return;
    this.characterData.startingPackageId = packageId;
    this.characterData.startingPackageChoices = {};
    const view = this._buildStartingEquipmentView();
    const pkg = (view.packages || []).find((p) => p.id === packageId);
    for (const choice of pkg?.choices || []) {
      if (choice.options?.[0]) {
        this.characterData.startingPackageChoices[choice.id] = choice.options[0].id;
      }
    }
    const items = resolveSelectedPackageItems(pkg, this.characterData.startingPackageChoices);
    this.characterData.selectedEquipmentIds = items.map((i) => i.id).filter(Boolean);
    this.render();
  }

  onSelectPackageChoice(event, target) {
    event?.stopPropagation?.();
    target = this._actionEl(event, target);
    const packageId = target?.dataset?.packageId;
    const choiceId = target?.dataset?.choiceId;
    const optionId = target?.dataset?.optionId;
    if (!packageId || !choiceId || !optionId) return;
    if (this.characterData.startingPackageId !== packageId) {
      this.characterData.startingPackageId = packageId;
      this.characterData.startingPackageChoices = {};
    }
    this.characterData.startingPackageChoices[choiceId] = optionId;
    const view = this._buildStartingEquipmentView();
    const pkg = (view.packages || []).find((p) => p.id === packageId);
    const items = resolveSelectedPackageItems(pkg, this.characterData.startingPackageChoices);
    this.characterData.selectedEquipmentIds = items.map((i) => i.id).filter(Boolean);
    this.render();
  }

  // ===== SKILLS / FEATS =====

  onToggleSkill(event, target) {
    target = this._actionEl(event, target);
    if (!target?.dataset || target.disabled || target.hasAttribute?.('disabled')) return;
    const key = target.dataset.skillKey;
    if (!key) return;
    if (!Array.isArray(this.characterData.skillProficiencies)) this.characterData.skillProficiencies = [];
    const list = this.characterData.skillProficiencies;
    const idx = list.indexOf(key);
    const choices = this._buildSkillChoices();
    const max = choices.total || 0;
    if (idx >= 0) {
      list.splice(idx, 1);
    } else {
      if (list.length >= max) {
        ui.notifications?.warn?.(`You can only select ${max} skills.`);
        return;
      }
      list.push(key);
    }
    this.render();
  }

  onToggleFeat(event, target) {
    target = this._actionEl(event, target);
    const name = target?.dataset?.featName;
    if (!name) return;
    if (!Array.isArray(this.characterData.feats)) this.characterData.feats = [];
    const slots = this._featSlotsAvailable();
    const list = this.characterData.feats;
    const idx = list.indexOf(name);
    if (idx >= 0) {
      list.splice(idx, 1);
    } else {
      const used = (this.characterData.chooseASI ? 1 : 0) + list.length;
      if (slots <= 0) {
        ui.notifications?.warn?.('No feat slots at this level.');
        return;
      }
      if (used >= slots) {
        ui.notifications?.warn?.(`You only have ${slots} feat / ASI slot(s).`);
        return;
      }
      list.push(name);
    }
    this.render();
  }

  onToggleASI() {
    const slots = this._featSlotsAvailable();
    if (!this.characterData.chooseASI) {
      const used = this.characterData.feats?.length || 0;
      if (slots <= 0 || used >= slots) {
        ui.notifications?.warn?.('No ASI slots available (or feats already fill them).');
        return;
      }
      this.characterData.chooseASI = true;
    } else {
      this.characterData.chooseASI = false;
    }
    this.render();
  }

  // ===== PROFICIENCY HANDLERS =====

  onToggleLanguage(event, target) {
    target = this._actionEl(event, target);
    const langId = target?.dataset?.langId || target?.value;
    if (!langId || target.disabled) return;

    if (!this.characterData.proficiencies.languages) this.characterData.proficiencies.languages = [];

    const isSelected = this.characterData.proficiencies.languages.includes(langId);
    const maxLanguages = this._getTotalLanguageSlots();
    const raceLangs = this._getRaceLanguages();
    const grantedCount = raceLangs.length;

    const currentChoices = this.characterData.proficiencies.languages.filter(l => !raceLangs.includes(l)).length;

    if (!isSelected) {
      if (currentChoices >= (maxLanguages - grantedCount)) {
        ui.notifications.warn(`No more language choices available! (Max ${maxLanguages - grantedCount})`);
        return;
      }
      this.characterData.proficiencies.languages.push(langId);
    } else {
      this.characterData.proficiencies.languages = this.characterData.proficiencies.languages.filter(id => id !== langId);
    }
    this.render();
  }

  onToggleArmorProf(event, target) {
    target = this._actionEl(event, target);
    const armorId = target?.dataset?.armorId || target?.value;
    if (!armorId || target.disabled) return;
    if (!this.characterData.proficiencies.armor) this.characterData.proficiencies.armor = [];
    const isSelected = this.characterData.proficiencies.armor.includes(armorId);
    if (!isSelected) {
      this.characterData.proficiencies.armor.push(armorId);
    } else {
      this.characterData.proficiencies.armor = this.characterData.proficiencies.armor.filter(id => id !== armorId);
    }
    this.render();
  }

  onToggleWeaponProf(event, target) {
    target = this._actionEl(event, target);
    const weaponId = target?.dataset?.weaponId || target?.value;
    if (!weaponId || target.disabled) return;
    if (!this.characterData.proficiencies.weapons) this.characterData.proficiencies.weapons = [];
    const isSelected = this.characterData.proficiencies.weapons.includes(weaponId);
    if (!isSelected) {
      this.characterData.proficiencies.weapons.push(weaponId);
    } else {
      this.characterData.proficiencies.weapons = this.characterData.proficiencies.weapons.filter(id => id !== weaponId);
    }
    this.render();
  }

  onToggleToolProf(event, target) {
    target = this._actionEl(event, target);
    const toolId = target?.dataset?.toolId || target?.value;
    if (!toolId || target.disabled) return;
    if (!this.characterData.proficiencies.tools) this.characterData.proficiencies.tools = [];
    const isSelected = this.characterData.proficiencies.tools.includes(toolId);
    if (!isSelected) {
      this.characterData.proficiencies.tools.push(toolId);
    } else {
      this.characterData.proficiencies.tools = this.characterData.proficiencies.tools.filter(id => id !== toolId);
    }
    this.render();
  }

  // ===== FORM INPUT HANDLER =====

  _onFormInputChange(event) {
    const input = event.target;
    const name = input.name;
    const value = input.value;
    if (!name) return;

    const forbidden = new Set(['__proto__', 'constructor', 'prototype']);
    const parts = name.split('.').filter(Boolean);
    if (!parts.length || parts.some((p) => forbidden.has(p))) return;

    let target = this.characterData;
    for (let i = 0; i < parts.length - 1; i++) {
      const key = parts[i];
      if (typeof target[key] !== 'object' || target[key] === null) target[key] = {};
      target = target[key];
    }

    const finalKey = parts[parts.length - 1];
    target[finalKey] = input.type === 'number' ? (parseInt(value, 10) || 0) : value;

    if (typeof this._updateDerivedStats === 'function') this._updateDerivedStats();

    if (this._renderDebounceTimer) clearTimeout(this._renderDebounceTimer);
    this._renderDebounceTimer = setTimeout(() => {
      if (typeof this.render === 'function') this.render();
    }, 100);
  }

  // ===== DRAG & DROP HANDLERS =====

  _onDragStart(event) {
    const target = event.currentTarget;
    target.classList.add('dragging');
    event.dataTransfer.effectAllowed = 'move';
    const dragData = {
      score: target.dataset.score,
      sourceAbility: target.dataset.sourceAbility || null,
      poolIndex: target.dataset.poolIndex || null,
      fromAssigned: target.dataset.fromAssigned === 'true'
    };
    event.dataTransfer.setData('text/plain', JSON.stringify(dragData));
  }

  _onDragEnd(event) {
    event.currentTarget.classList.remove('dragging');
    this.element?.querySelectorAll('.drag-over').forEach(z => z.classList.remove('drag-over'));
  }

  _onDragOver(event) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    event.currentTarget.classList.add('drag-over');
  }

  _onDragLeave(event) {
    event.currentTarget.classList.remove('drag-over');
  }

  _onDrop(event) {
    event.preventDefault();
    const zone = event.currentTarget;
    zone.classList.remove('drag-over');

    try {
      const data = JSON.parse(event.dataTransfer.getData('text/plain'));
      const ability = zone.dataset.ability;
      const score = parseInt(data.score);
      if (!ability || isNaN(score)) return;

      if (this.characterData.abilities[ability]) this._returnScoreToPool(ability);

      this.characterData.abilities[ability] = score;
      this.abilityManager.assignScore(ability, score);

      if (data.poolIndex !== null && data.poolIndex !== undefined && this.abilityManager.rolledPool) {
        const idx = parseInt(data.poolIndex);
        if (idx >= 0 && idx < this.abilityManager.rolledPool.length) this.abilityManager.rolledPool.splice(idx, 1);
      }

      if (data.sourceAbility && this.abilityManager.rolledScores) {
        delete this.abilityManager.rolledScores[data.sourceAbility];
        if (this.abilityManager.diceBreakdowns) delete this.abilityManager.diceBreakdowns[data.sourceAbility];
      }

      if (data.fromAssigned && data.sourceAbility) {
        delete this.characterData.abilities[data.sourceAbility];
        delete this.abilityManager.assignedAbilities[data.sourceAbility];
      }

      this._playDropSound();
      this.render();
    } catch (err) {
      console.error('LD Axyum | Drop error:', err);
    }
  }

  _returnScoreToPool(ability) {
    const score = this.characterData.abilities[ability];
    if (score && this.abilityManager.rolledPool) {
      this.abilityManager.rolledPool.push({ value: score, breakdown: '', assigned: false });
      this.abilityManager.rolledPool.sort((a, b) => b.value - a.value);
    }
  }

  _playDropSound() {
    if (game.settings.get('core', 'globalAmbientVolume') > 0) {
      const AudioAPI = globalThis.foundry?.audio?.AudioHelper ?? globalThis.AudioHelper;
      if (AudioAPI && typeof AudioAPI.play === 'function') {
        try {
          const maybe = AudioAPI.play({ src: 'sounds/dice.wav', volume: 0.3, autoplay: true }, false);
          if (maybe && typeof maybe.catch === 'function') maybe.catch(e => console.warn('Axyum | Audio play failed:', e));
        } catch (e) { console.warn('Axyum | Audio play failed:', e); }
      }
    }
  }
};
