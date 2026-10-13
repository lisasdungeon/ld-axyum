/**
 * Lazy template preload for LD Axyum.
 * Fetches Handlebars templates and registers them as partials.
 */

const TEMPLATE_PATHS = [
  'modules/ld-axyum/ui/axyum-app.hbs',
  'modules/ld-axyum/ui/pages/welcome.hbs',
  'modules/ld-axyum/ui/pages/role.hbs',
  'modules/ld-axyum/ui/pages/class.hbs',
  'modules/ld-axyum/ui/pages/multiclass.hbs',
  'modules/ld-axyum/ui/pages/race.hbs',
  'modules/ld-axyum/ui/pages/background.hbs',
  'modules/ld-axyum/ui/pages/abilities.hbs',
  'modules/ld-axyum/ui/pages/skills.hbs',
  'modules/ld-axyum/ui/pages/proficiencies.hbs',
  'modules/ld-axyum/ui/pages/equipment.hbs',
  'modules/ld-axyum/ui/pages/spells.hbs',
  'modules/ld-axyum/ui/pages/details.hbs',
  'modules/ld-axyum/ui/pages/biography.hbs',
  'modules/ld-axyum/ui/pages/summary.hbs',
  'modules/ld-axyum/ui/pages/feat-selection.hbs',
  'modules/ld-axyum/ui/sheet/character-sheet.hbs',
  'modules/ld-axyum/ui/sheet/axyum-character-preview-simple.hbs',
  'modules/ld-axyum/ui/modals/export-modal.hbs',
  'modules/ld-axyum/ui/modals/import-modal.hbs',
  'modules/ld-axyum/ui/modals/compendium-selector.hbs'
];

export async function preloadHandlebarsTemplates() {
  const fetchPromises = TEMPLATE_PATHS.map(async (path) => {
    try {
      const response = await fetch(path);
      if (!response.ok) return null;
      const text = await response.text();
      return { path, text };
    } catch (err) {
      console.warn(`LD Axyum | Failed to load template: ${path}`);
      return null;
    }
  });

  const results = await Promise.all(fetchPromises);

  for (const result of results) {
    if (!result) continue;
    const { path, text } = result;
    const partialName = path.replace(/\.hbs$/, '');
    Handlebars.registerPartial(partialName, text);
  }

  console.log('LD Axyum | Templates loaded and partials registered');
}
