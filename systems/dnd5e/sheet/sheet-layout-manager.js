/**
 * SheetLayoutManager - pure layout math for the free-form, editable
 * character sheet canvas. No DOM/Foundry references, so it's unit-testable.
 */

export const WIDGET_TYPES = {
  header: { label: 'Header', minWidth: 480, minHeight: 120, defaultSize: { width: 900, height: 140 } },
  abilities: { label: 'Ability Scores', minWidth: 320, minHeight: 180, defaultSize: { width: 440, height: 260 } },
  combat: { label: 'Combat', minWidth: 280, minHeight: 160, defaultSize: { width: 440, height: 220 } },
  skills: { label: 'Skills', minWidth: 300, minHeight: 180, defaultSize: { width: 440, height: 320 } },
  equipment: { label: 'Equipment', minWidth: 280, minHeight: 140, defaultSize: { width: 440, height: 220 } },
  spells: { label: 'Spells', minWidth: 300, minHeight: 160, defaultSize: { width: 440, height: 260 } },
  features: { label: 'Features & Traits', minWidth: 280, minHeight: 120, defaultSize: { width: 440, height: 180 } },
  biography: { label: 'Biography', minWidth: 300, minHeight: 160, defaultSize: { width: 440, height: 220 } }
};

const DEFAULT_COLOR = '#7dd3fc';
const CANVAS_PADDING = 60;
const MIN_CANVAS_WIDTH = 900;
const MIN_CANVAS_HEIGHT = 600;

function uid(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Build the out-of-box layout: one "Main" page, widgets stacked in the current visual arrangement. */
export function createDefaultLayout(hasSpells = true) {
  const pageId = 'main';
  const gap = 16;
  const colX = [16, 456];
  const widgets = [
    widget('header', pageId, colX[0], 16, 880, 140),
    widget('abilities', pageId, colX[0], 172, 440, 260),
    widget('combat', pageId, colX[0], 448, 440, 220),
    widget('skills', pageId, colX[1], 172, 440, 320),
    widget('equipment', pageId, colX[1], 508, 440, 220)
  ];
  if (hasSpells) widgets.push(widget('spells', pageId, colX[1], 744, 440, 260));
  widgets.push(widget('features', pageId, colX[0], 684, 440, 180));
  widgets.push(widget('biography', pageId, colX[0], gap + 684 + 180 + gap, 440, 220));

  return {
    version: 1,
    pages: [{ id: pageId, name: 'Main' }],
    widgets
  };
}

function widget(type, page, x, y, width, height) {
  const def = WIDGET_TYPES[type];
  return {
    id: uid(type),
    type,
    page,
    x, y,
    width: width ?? def.defaultSize.width,
    height: height ?? def.defaultSize.height,
    color: DEFAULT_COLOR
  };
}

/** Repair a saved layout: fill in any widget types missing from the data model, drop unknown ones. */
export function normalizeLayout(layout, hasSpells = true) {
  if (!layout || !Array.isArray(layout.pages) || !layout.pages.length) return createDefaultLayout(hasSpells);

  const pages = layout.pages.filter((p) => p?.id && p?.name);
  if (!pages.length) return createDefaultLayout(hasSpells);

  const knownTypes = new Set(Object.keys(WIDGET_TYPES));
  let widgets = (Array.isArray(layout.widgets) ? layout.widgets : [])
    .filter((w) => w?.id && knownTypes.has(w.type) && pages.some((p) => p.id === w.page))
    .map((w) => clampWidget(w));

  const present = new Set(widgets.map((w) => w.type));
  const firstPage = pages[0].id;
  let dropY = Math.max(0, ...widgets.filter((w) => w.page === firstPage).map((w) => w.y + w.height)) + 16;
  for (const type of Object.keys(WIDGET_TYPES)) {
    if (type === 'spells' && !hasSpells) continue;
    if (!present.has(type)) {
      const w = widget(type, firstPage, 16, dropY, undefined, undefined);
      widgets.push(w);
      dropY += w.height + 16;
    }
  }
  if (!hasSpells) widgets = widgets.filter((w) => w.type !== 'spells');

  return { version: 1, pages, widgets };
}

/** Keep a widget's geometry sane: no negative/zero size, respects the type's minimums. */
export function clampWidget(w) {
  const def = WIDGET_TYPES[w.type] || { minWidth: 200, minHeight: 100 };
  return {
    ...w,
    x: Math.max(0, Math.round(w.x ?? 0)),
    y: Math.max(0, Math.round(w.y ?? 0)),
    width: Math.max(def.minWidth, Math.round(w.width ?? def.defaultSize?.width ?? def.minWidth)),
    height: Math.max(def.minHeight, Math.round(w.height ?? def.defaultSize?.height ?? def.minHeight)),
    color: w.color || DEFAULT_COLOR
  };
}

/** Canvas must be big enough to contain every widget on the given page, plus padding. */
export function computeCanvasSize(layout, pageId) {
  const widgets = layout.widgets.filter((w) => w.page === pageId);
  let maxX = MIN_CANVAS_WIDTH - CANVAS_PADDING;
  let maxY = MIN_CANVAS_HEIGHT - CANVAS_PADDING;
  for (const w of widgets) {
    maxX = Math.max(maxX, w.x + w.width);
    maxY = Math.max(maxY, w.y + w.height);
  }
  return { width: maxX + CANVAS_PADDING, height: maxY + CANVAS_PADDING };
}

export function moveWidget(layout, widgetId, x, y) {
  const widgets = layout.widgets.map((w) => (w.id === widgetId ? clampWidget({ ...w, x, y }) : w));
  return { ...layout, widgets };
}

export function resizeWidget(layout, widgetId, width, height) {
  const widgets = layout.widgets.map((w) => (w.id === widgetId ? clampWidget({ ...w, width, height }) : w));
  return { ...layout, widgets };
}

export function setWidgetColor(layout, widgetId, color) {
  const widgets = layout.widgets.map((w) => (w.id === widgetId ? { ...w, color } : w));
  return { ...layout, widgets };
}

export function setWidgetPage(layout, widgetId, pageId) {
  if (!layout.pages.some((p) => p.id === pageId)) return layout;
  const widgets = layout.widgets.map((w) => (w.id === widgetId ? { ...w, page: pageId, x: 16, y: 16 } : w));
  return { ...layout, widgets };
}

export function addPage(layout, name) {
  const id = uid('page');
  return { ...layout, pages: [...layout.pages, { id, name: name || 'New Page' }] };
}

export function renamePage(layout, pageId, name) {
  const pages = layout.pages.map((p) => (p.id === pageId ? { ...p, name: name || p.name } : p));
  return { ...layout, pages };
}

/** Deleting a page reassigns its widgets to the first remaining page rather than losing them. */
export function deletePage(layout, pageId) {
  if (layout.pages.length <= 1) return layout;
  const pages = layout.pages.filter((p) => p.id !== pageId);
  const fallback = pages[0].id;
  const widgets = layout.widgets.map((w) => (w.page === pageId ? { ...w, page: fallback, x: 16, y: 16 } : w));
  return { ...layout, pages, widgets };
}

export function resetLayout(hasSpells = true) {
  return createDefaultLayout(hasSpells);
}
