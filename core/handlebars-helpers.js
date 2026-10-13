/**
 * Handlebars helpers for LD Axyum.
 * Registered once on first initialization trigger.
 */

function hasHandlebarsHelper(name) {
  if (Handlebars.helpers?.[name]) return true;
  if (typeof Handlebars.helpers?.get === 'function' && Handlebars.helpers.get(name)) return true;
  return false;
}

function registerHandlebarsHelper(name, fn) {
  if (hasHandlebarsHelper(name)) return;
  Handlebars.registerHelper(name, fn);
}

export function registerHandlebarsHelpers() {
  registerHandlebarsHelper('eq', (a, b) => a === b);
  registerHandlebarsHelper('ne', (a, b) => a !== b);
  registerHandlebarsHelper('gt', (a, b) => a > b);
  registerHandlebarsHelper('gte', (a, b) => a >= b);
  registerHandlebarsHelper('lt', (a, b) => a < b);
  registerHandlebarsHelper('lte', (a, b) => a <= b);
  registerHandlebarsHelper('add', (a, b) => a + b);
  registerHandlebarsHelper('sum', (a, b) => a + b);
  registerHandlebarsHelper('includes', (arr, val) => Array.isArray(arr) && arr.includes(val));
  registerHandlebarsHelper('subtract', (a, b) => a - b);
  registerHandlebarsHelper('multiply', (a, b) => a * b);
  registerHandlebarsHelper('divide', (a, b) => b !== 0 ? Math.floor(a / b) : 0);
  registerHandlebarsHelper('abs', (a) => Math.abs(a));
  registerHandlebarsHelper('percent', (current, total) => Math.round((current / (total || 1)) * 100));
  // Never replace Foundry's localize helper. Replacing it blanks core UI templates.
  registerHandlebarsHelper('uppercase', (str) => String(str || '').toUpperCase());
  registerHandlebarsHelper('localize', (key) => game.i18n?.localize?.(String(key)) || String(key));
  registerHandlebarsHelper('formatModifier', (value) => {
    const num = Number(value) || 0;
    return num >= 0 ? `+${num}` : `${num}`;
  });
  registerHandlebarsHelper('abilityMod', (score) => {
    const s = Number(score) || 10;
    const mod = Math.floor((s - 10) / 2);
    return mod >= 0 ? `+${mod}` : `${mod}`;
  });
  registerHandlebarsHelper('sumAll', function() {
    const args = Array.prototype.slice.call(arguments, 0, -1);
    return args.reduce((sum, val) => sum + (Number(val) || 0), 0);
  });
  registerHandlebarsHelper('join', (arr, separator) => {
    if (!Array.isArray(arr)) return '';
    return arr.join(separator || ', ');
  });
  registerHandlebarsHelper('repeat', function(count, options) {
    let result = '';
    for (let i = 0; i < count; i++) {
      result += options.fn({ index: i });
    }
    return result;
  });
  registerHandlebarsHelper('lookup', (obj, key) => {
    if (!obj) return null;
    return obj[key];
  });
}
