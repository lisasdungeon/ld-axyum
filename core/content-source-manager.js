/**
 * Content Source Manager for LD Axyum
 * Handles world folders and content source configuration
 * @module content-source-manager
 */

export class ContentSourceManager {
  constructor() {
    this.worldFolders = new Map();
    this.folderConfig = new Map();
  }

  /**
   * Scan world folders for content
   */
  scanWorldFolders() {
    try {
      if (!game?.folders) return new Map();

      const folders = new Map();
      const worldFolders = game.folders.filter(f => f.type === 'Actor' || f.type === 'Item');

      for (const folder of worldFolders) {
        const folderData = {
          id: folder.id,
          name: folder.name,
          type: folder.type,
          path: folder.path,
          contents: folder.contents,
          itemCount: folder.contents?.length || 0,
          contentTypes: this._detectFolderContentTypes(folder)
        };

        folders.set(folder.id, folderData);
      }

      this.worldFolders = folders;
      return folders;
    } catch (err) {
      console.warn('ContentSourceManager | Failed to scan world folders', err);
      return new Map();
    }
  }

  /**
   * Detect what content types are in a folder
   */
  _detectFolderContentTypes(folder) {
    const types = new Set();
    const contents = folder.contents || [];

    for (const item of contents) {
      const itemType = item.type;
      if (['class', 'race', 'background', 'feat', 'spell'].includes(itemType)) {
        types.add(itemType);
      }
    }

    return Array.from(types);
  }

  /**
   * Get available folders for a content category
   */
  getAvailableFoldersForCategory(category) {
    const typeMap = {
      'classes': 'class',
      'races': 'race',
      'backgrounds': 'background',
      'feats': 'feat',
      'spells': 'spell'
    };

    const targetType = typeMap[category];
    if (!targetType) return [];

    const matchingFolders = [];
    for (const [folderId, folderData] of this.worldFolders) {
      if (folderData.contentTypes.includes(targetType)) {
        matchingFolders.push({
          id: folderId,
          name: folderData.name,
          path: folderData.path,
          itemCount: folderData.itemCount,
          type: 'world-folder'
        });
      }
    }

    return matchingFolders;
  }

  /**
   * Get all available content sources for a category (compendia + folders)
   */
  getAllContentSources(category) {
    const sources = {
      compendia: [],
      worldFolders: []
    };

    const typeMap = {
      'classes': ['class', 'subclass'],
      'races': ['race'],
      'backgrounds': ['background'],
      'feats': ['feat'],
      'spells': ['spell']
    };

    const targetTypes = typeMap[category] || [];

    try {
      if (game?.packs) {
        for (const pack of game.packs) {
          const packType = pack.metadata?.type;
          if (targetTypes.includes(packType)) {
            sources.compendia.push({
              id: pack.collection || pack.name,
              name: pack.metadata?.label || pack.name,
              itemCount: pack.index?.size || 0,
              type: 'compendium'
            });
          }
        }
      }
    } catch (err) {
      console.warn('ContentSourceManager | Error scanning compendia for sources', err);
    }

    sources.worldFolders = this.getAvailableFoldersForCategory(category);

    return sources;
  }

  /**
   * Load content source configuration
   */
  async loadContentSourceConfig() {
    try {
      const categories = ['classes', 'races', 'backgrounds', 'feats', 'spells'];
      
      for (const category of categories) {
        const saved = game?.settings?.get?.('ld-axyum', `contentSources_${category}`);
        if (saved) {
          this.folderConfig.set(category, saved);
        }
      }
    } catch (err) {
      console.warn('ContentSourceManager | Failed to load content source config', err);
    }
  }

  /**
   * Save GM's content source configuration for a category
   */
  saveContentSourceConfig(category, selectedSources, clearCacheCallback) {
    if (!selectedSources || !Array.isArray(selectedSources)) {
      console.warn('ContentSourceManager | Invalid source configuration');
      return false;
    }

    try {
      this.folderConfig.set(category, selectedSources);
      
      // Persist under single multipath Object setting (not dynamic keys)
      try {
        const store = game.settings.get('ld-axyum', 'contentSources') || { byCategory: {} };
        if (!store.byCategory || typeof store.byCategory !== 'object') store.byCategory = {};
        store.byCategory[category] = selectedSources;
        game.settings.set('ld-axyum', 'contentSources', store);
      } catch (e) {
        console.warn('ContentSourceManager | contentSources setting unavailable', e);
      }

      // Clear related caches
      if (clearCacheCallback) {
        clearCacheCallback(category);
      }
      
      return true;
    } catch (err) {
      console.warn('ContentSourceManager | Failed to save content source config', err);
      return false;
    }
  }

  /**
   * Load content from a world folder
   */
  async loadFromFolder(folderId, category) {
    const folder = this.worldFolders.get(folderId);
    if (!folder) return [];

    const typeMap = {
      'classes': 'class',
      'races': 'race',
      'backgrounds': 'background',
      'feats': 'feat',
      'spells': 'spell'
    };

    const targetType = typeMap[category];
    const content = [];

    try {
      const contents = folder.contents || [];
      for (const item of contents) {
        if (item.type === targetType) {
          content.push({
            id: item.id,
            name: item.name,
            type: item.type,
            source: `World: ${folder.name}`,
            data: item.toObject?.() || item,
            isWorldContent: true,
            folderId: folderId
          });
        }
      }
    } catch (err) {
      console.warn(`ContentSourceManager | Failed to load from folder ${folderId}`, err);
    }

    return content;
  }

  /**
   * Load content from a compendium
   */
  async loadFromCompendium(compendiumId, category) {
    const pack = game?.packs?.get?.(compendiumId);
    if (!pack) return [];

    const content = [];
    try {
      const index = await pack.getIndex();
      for (const entry of index) {
        const item = await pack.getDocument(entry._id);
        if (item) {
          content.push({
            id: item.id,
            name: item.name,
            type: item.type,
            source: `Compendium: ${pack.metadata?.label || pack.name}`,
            data: item.toObject?.() || item,
            isCompendiumContent: true,
            compendium: compendiumId
          });
        }
      }
    } catch (err) {
      console.warn(`ContentSourceManager | Failed to load from compendium ${compendiumId}`, err);
    }

    return content;
  }

  /**
   * Load content from specific sources (compendia and/or world folders)
   */
  async loadFromSpecificSources(category, sources) {
    const content = [];

    for (const source of sources) {
      try {
        if (source.type === 'compendium') {
          const compendiumContent = await this.loadFromCompendium(source.id, category);
          content.push(...compendiumContent);
        } else if (source.type === 'world-folder') {
          const folderContent = await this.loadFromFolder(source.id, category);
          content.push(...folderContent);
        }
      } catch (err) {
        console.warn(`ContentSourceManager | Failed to load from source ${source.name}`, err);
      }
    }

    return content;
  }
}
