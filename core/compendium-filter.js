/**
 * CompendiumFilter - Handles filtering logic for compendium items
 */
export class CompendiumFilter {
  constructor() {
    this.selectedCompendiumFilter = 'all';
    this.selectedRaceCompendiumFilter = 'all';
    this.selectedBackgroundCompendiumFilter = 'all';
    this.showHomebrew = true;
    this.selectedRoleIndex = null;
  }

  setCompendiumFilter(type, value) {
    switch(type) {
      case 'class':
        this.selectedCompendiumFilter = value;
        break;
      case 'race':
        this.selectedRaceCompendiumFilter = value;
        break;
      case 'background':
        this.selectedBackgroundCompendiumFilter = value;
        break;
    }
  }

  getCompendiumFilter(type) {
    switch(type) {
      case 'class':
        return this.selectedCompendiumFilter;
      case 'race':
        return this.selectedRaceCompendiumFilter;
      case 'background':
        return this.selectedBackgroundCompendiumFilter;
      default:
        return 'all';
    }
  }

  setHomebrewVisibility(show) {
    this.showHomebrew = show;
  }

  getHomebrewVisibility() {
    return this.showHomebrew;
  }

  setSelectedRole(roleIndex) {
    this.selectedRoleIndex = roleIndex;
  }

  getSelectedRole() {
    return this.selectedRoleIndex;
  }

  filterHomebrewItems(items) {
    if (this.showHomebrew || !Array.isArray(items)) {
      return items;
    }
    return items.filter(item => !item?.isHomebrew);
  }

  getRecommendedClassesForRole(roleIndex) {
    const roleClassMap = {
      0: ['Fighter', 'Paladin', 'Barbarian'],
      1: ['Rogue', 'Ranger', 'Fighter', 'Sorcerer', 'Warlock'],
      2: ['Wizard', 'Druid', 'Cleric', 'Sorcerer'],
      3: ['Bard', 'Cleric', 'Paladin', 'Druid'],
      4: ['Cleric', 'Druid', 'Paladin', 'Bard'],
      5: ['Rogue', 'Bard', 'Ranger', 'Artificer'],
      6: ['Bard', 'Paladin', 'Warlock', 'Sorcerer'],
      7: null
    };
    return roleClassMap[roleIndex] || null;
  }

  isClassRecommendedForRole(className, roleIndex = this.selectedRoleIndex) {
    if (roleIndex === null || roleIndex === 7) return false;
    const recommended = this.getRecommendedClassesForRole(roleIndex) || [];
    return recommended.some((name) =>
      String(className || '').toLowerCase().includes(String(name).toLowerCase())
    );
  }

  /**
   * Soft role filter: tag + sort recommended classes, never hide PHB/Tasha/etc.
   */
  filterClassesByRole(classes) {
    if (!Array.isArray(classes)) return [];

    if (this.selectedRoleIndex === null || this.selectedRoleIndex === 7) {
      return classes.map((cls) => ({ ...cls, recommended: false }));
    }

    const recommendedClasses = this.getRecommendedClassesForRole(this.selectedRoleIndex) || [];
    const tagged = classes.map((cls) => {
      const recommended = recommendedClasses.some((recommended) =>
        String(cls.name || '').toLowerCase().includes(String(recommended).toLowerCase())
      );
      return { ...cls, recommended };
    });

    return tagged.sort((a, b) => {
      if (a.recommended !== b.recommended) return a.recommended ? -1 : 1;
      return String(a.name || '').localeCompare(String(b.name || ''));
    });
  }

  filterByCompendium(items, filterValue) {
    if (!filterValue || filterValue === 'all') {
      return items;
    }
    return items.filter(item => item.packName === filterValue);
  }

  getSourceBadge(item) {
    if (!item?.source) return '';
    
    const isHomebrew = item.isHomebrew || (item.source && item.source !== 'PHB');
    const badgeClass = isHomebrew ? 'homebrew' : 'official';
    const badgeIcon = isHomebrew ? '<i class="fas fa-scroll"></i>' : '<i class="fas fa-book"></i>';
    
    return `<span class="source-badge ${badgeClass}" title="${item.source}">${badgeIcon}${item.source}</span>`;
  }

  getClassIcon(className) {
    const icons = {
      'Barbarian': 'fas fa-fire',
      'Bard': 'fas fa-music',
      'Cleric': 'fas fa-cross',
      'Druid': 'fas fa-leaf',
      'Fighter': 'fas fa-shield-alt',
      'Monk': 'fas fa-hand-fist',
      'Paladin': 'fas fa-horse',
      'Ranger': 'fas fa-bow',
      'Rogue': 'fas fa-mask',
      'Sorcerer': 'fas fa-wand-magic',
      'Warlock': 'fas fa-book',
      'Wizard': 'fas fa-hat-wizard'
    };
    return icons[className] || 'fas fa-star';
  }

  applyAllFilters(items, type) {
    let filtered = items || [];
    
    filtered = this.filterHomebrewItems(filtered);

    if (type === 'class') {
      filtered = this.filterClassesByRole(filtered);
      filtered = this.filterByCompendium(filtered, this.selectedCompendiumFilter);
    } else if (type === 'race') {
      filtered = this.filterByCompendium(filtered, this.selectedRaceCompendiumFilter);
    } else if (type === 'background') {
      filtered = this.filterByCompendium(filtered, this.selectedBackgroundCompendiumFilter);
    }

    return filtered;
  }

  reset() {
    this.selectedCompendiumFilter = 'all';
    this.selectedRaceCompendiumFilter = 'all';
    this.selectedBackgroundCompendiumFilter = 'all';
    this.showHomebrew = true;
    this.selectedRoleIndex = null;
  }
}
