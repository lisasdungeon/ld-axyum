/**
 * Shared localization helper for LD modules
 * Provides common i18n utilities
 */

function hasHandlebarsHelper(name) {
  if (Handlebars.helpers?.[name]) return true;
  if (typeof Handlebars.helpers?.get === 'function' && Handlebars.helpers.get(name)) return true;
  return false;
}

export function setupLocalizationHelper() {
  // Never replace Foundry's localize helper. Replacing it blanks core UI templates.
  if (!hasHandlebarsHelper('localize')) {
    Handlebars.registerHelper('localize', (key) => {
      try {
        if (typeof game !== 'undefined' && game?.i18n && typeof game.i18n.localize === 'function') {
          return game.i18n.localize(String(key));
        }
      } catch (err) {
        console.warn('Localization helper error for key:', key, err);
      }
      return String(key);
    });
  }

  if (!hasHandlebarsHelper('format')) {
    Handlebars.registerHelper('format', (key, options) => {
      try {
        if (typeof game !== 'undefined' && game?.i18n && typeof game.i18n.format === 'function') {
          const params = options && options.hash ? options.hash : {};
          return game.i18n.format(String(key), params);
        }
      } catch (err) {
        console.warn('Format helper error for key:', key, err);
      }
      return String(key);
    });
  }
}
