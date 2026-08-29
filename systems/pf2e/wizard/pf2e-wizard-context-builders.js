/**
 * Pf2eWizardContextBuilders - mixin with data loading and view-model builder
 * helpers consumed by Pf2eWizardApp._prepareContext. Mirrors the role of
 * core/axyum-context-builders.js, pf2e content instead of dnd5e.
 */
import { Pf2eCompendiumLoader } from '../data/pf2e-compendium-loader.js';
import { Pf2eCompendiumQueries } from '../data/pf2e-compendium-queries.js';
import { Pf2eRulesEngine } from '../rules/pf2e-rules-engine.js';
import { Pf2eAbilityBoostCalculator } from '../rules/calculators/pf2e-ability-boost-calculator.js';

export const Pf2eWizardContextBuilders = (Base) => class extends Base {

  async _loadAvailableOptions() {
    try {
      let loader = this.compendium;
      if (!loader) {
        loader = new Pf2eCompendiumLoader();
        this.compendium = loader;
      }
      const cache = await loader.getOrLoadAll();
      this.queries = new Pf2eCompendiumQueries(cache);
      return cache;
    } catch (err) {
      console.error('Pf2eWizardApp | Failed to load pf2e content', err);
      this.queries = new Pf2eCompendiumQueries({});
      return {};
    }
  }

  _getFinalAbilities() {
    const boosts = this.characterData.abilityBoosts || {};
    return Pf2eAbilityBoostCalculator.computeFinalAbilities({
      ancestryBoosts: boosts.ancestry,
      ancestryFlaws: this.characterData.ancestry?.flaws,
      backgroundBoost: boosts.background,
      classBoost: boosts.class,
      freeBoosts: boosts.free
    });
  }

  _buildDerivedStats() {
    const abilities = this._getFinalAbilities();
    const mods = Pf2eRulesEngine.getAbilityModifiers(abilities);
    const level = this.characterData.level || 1;
    const pwol = !!this.characterData.proficiencyWithoutLevel;
    const profs = this.characterData.proficiencies || {};

    const hp = Pf2eRulesEngine.calculateHP({
      ancestryHP: this.characterData.ancestry?.hp || 0,
      classHPPerLevel: this.characterData.class?.hpPerLevel || 8,
      level,
      conModifier: mods.con
    });

    const saves = {};
    for (const key of ['fortitude', 'reflex', 'will']) {
      const ability = key === 'fortitude' ? 'con' : key === 'reflex' ? 'dex' : 'wis';
      saves[key] = {
        rank: profs.saves?.[key] || 'untrained',
        bonus: Pf2eRulesEngine.calculateSave({
          abilityModifier: mods[ability],
          rank: profs.saves?.[key],
          level,
          proficiencyWithoutLevel: pwol
        })
      };
    }

    const perception = Pf2eRulesEngine.calculatePerception({
      wisModifier: mods.wis,
      rank: profs.perception,
      level,
      proficiencyWithoutLevel: pwol
    });

    const classDC = Pf2eRulesEngine.calculateClassDC({
      keyAbilityModifier: mods[this.characterData.class?.keyAbility] || 0,
      rank: profs.classDC,
      level,
      proficiencyWithoutLevel: pwol
    });

    return { abilities, abilityModifiers: mods, hp, saves, perception, classDC, level };
  }

  _buildSkillsList() {
    const mods = this._buildDerivedStats().abilityModifiers;
    const level = this.characterData.level || 1;
    const pwol = !!this.characterData.proficiencyWithoutLevel;
    const skillRanks = this.characterData.proficiencies?.skills || {};

    return Pf2eRulesEngine.getCoreSkillSlugs().map((slug) => {
      const ability = Pf2eRulesEngine.getSkillAbility(slug);
      const rank = skillRanks[slug] || 'untrained';
      return {
        slug,
        label: slug.charAt(0).toUpperCase() + slug.slice(1),
        ability,
        rank,
        bonus: Pf2eRulesEngine.calculateSkillBonus({
          abilityModifier: mods[ability] || 0,
          rank,
          level,
          proficiencyWithoutLevel: pwol
        })
      };
    });
  }

  _buildFeatSections() {
    const level = this.characterData.level || 1;
    const slots = Pf2eRulesEngine.getFeatSlotsAtLevel(level);
    const categories = ['ancestry', 'class', 'skill', 'general'];
    const selected = this.characterData.feats || {};

    return categories.map((category) => ({
      category,
      slotsAvailable: slots[category] || 0,
      selectedCount: (selected[category] || []).length,
      options: this.queries?.getFeatsByCategory(category, level) || []
    }));
  }

  _isSpellcaster() {
    return !!this.characterData.class?.spellcasting;
  }

  _buildSpellsByRank() {
    if (!this._isSpellcaster()) return {};
    const tradition = this.characterData.class?.spellcasting?.tradition || null;
    const cantrips = this.queries?.getCantrips(tradition) || [];
    const rank1 = (this.queries?.getSpellsForTradition(tradition, 1) || []).filter((s) => (s.rank ?? 0) === 1);
    return { 0: cantrips, 1: rank1 };
  }

  _buildSpellPreview() {
    if (!this._isSpellcaster()) return null;
    const level = this.characterData.level || 1;
    return {
      slots: Pf2eRulesEngine.getSpellSlots(level),
      maxRank: Pf2eRulesEngine.getMaxSpellRank(level),
      cantripsKnown: Pf2eRulesEngine.getCantripsKnown(level)
    };
  }
};
