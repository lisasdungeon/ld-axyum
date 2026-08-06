import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createDefaultLayout, normalizeLayout, clampWidget, computeCanvasSize,
  moveWidget, resizeWidget, setWidgetColor, setWidgetPage,
  addPage, renamePage, deletePage, WIDGET_TYPES
} from '../systems/dnd5e/sheet/sheet-layout-manager.js';

test('createDefaultLayout includes every widget type when the actor is a caster', () => {
  const layout = createDefaultLayout(true);
  const types = layout.widgets.map((w) => w.type).sort();
  assert.deepEqual(types, Object.keys(WIDGET_TYPES).sort());
  assert.equal(layout.pages.length, 1);
});

test('createDefaultLayout omits the spells widget for non-casters', () => {
  const layout = createDefaultLayout(false);
  assert.ok(!layout.widgets.some((w) => w.type === 'spells'));
});

test('createDefaultLayout produces no negative coordinates or undersized widgets', () => {
  const layout = createDefaultLayout(true);
  for (const w of layout.widgets) {
    assert.ok(w.x >= 0 && w.y >= 0, `${w.type} has negative position`);
    const def = WIDGET_TYPES[w.type];
    assert.ok(w.width >= def.minWidth, `${w.type} width below minimum`);
    assert.ok(w.height >= def.minHeight, `${w.type} height below minimum`);
  }
});

test('clampWidget enforces per-type minimum size and non-negative position', () => {
  const clamped = clampWidget({ type: 'skills', x: -50, y: -10, width: 10, height: 5 });
  const def = WIDGET_TYPES.skills;
  assert.equal(clamped.x, 0);
  assert.equal(clamped.y, 0);
  assert.equal(clamped.width, def.minWidth);
  assert.equal(clamped.height, def.minHeight);
});

test('clampWidget fills in a default color when missing', () => {
  const clamped = clampWidget({ type: 'combat', x: 0, y: 0, width: 500, height: 300 });
  assert.ok(clamped.color);
});

test('normalizeLayout recovers a valid default when given garbage input', () => {
  const layout = normalizeLayout(null, true);
  assert.equal(layout.pages.length, 1);
  assert.ok(layout.widgets.length > 0);
});

test('normalizeLayout drops widgets referencing a page that no longer exists', () => {
  const bad = { pages: [{ id: 'main', name: 'Main' }], widgets: [{ id: 'w1', type: 'skills', page: 'ghost', x: 0, y: 0, width: 400, height: 300 }] };
  const layout = normalizeLayout(bad, true);
  assert.ok(!layout.widgets.some((w) => w.id === 'w1'));
});

test('normalizeLayout drops unknown widget types but keeps valid ones', () => {
  const bad = {
    pages: [{ id: 'main', name: 'Main' }],
    widgets: [
      { id: 'w1', type: 'not-a-real-type', page: 'main', x: 0, y: 0, width: 400, height: 300 },
      { id: 'w2', type: 'skills', page: 'main', x: 0, y: 0, width: 400, height: 300 }
    ]
  };
  const layout = normalizeLayout(bad, true);
  assert.ok(!layout.widgets.some((w) => w.id === 'w1'));
  assert.ok(layout.widgets.some((w) => w.id === 'w2'));
});

test('normalizeLayout backfills any widget type missing from a saved layout', () => {
  const partial = { pages: [{ id: 'main', name: 'Main' }], widgets: [{ id: 'w1', type: 'skills', page: 'main', x: 0, y: 0, width: 400, height: 300 }] };
  const layout = normalizeLayout(partial, true);
  const types = new Set(layout.widgets.map((w) => w.type));
  for (const type of Object.keys(WIDGET_TYPES)) assert.ok(types.has(type), `missing ${type}`);
});

test('computeCanvasSize grows to fit the furthest widget on a page, with padding', () => {
  const layout = { pages: [{ id: 'main', name: 'Main' }], widgets: [clampWidget({ type: 'skills', page: 'main', x: 1000, y: 800, width: 400, height: 300 })] };
  const size = computeCanvasSize(layout, 'main');
  assert.ok(size.width >= 1400);
  assert.ok(size.height >= 1100);
});

test('computeCanvasSize ignores widgets on other pages', () => {
  const layout = {
    pages: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }],
    widgets: [clampWidget({ type: 'skills', page: 'b', x: 5000, y: 5000, width: 400, height: 300 })]
  };
  const size = computeCanvasSize(layout, 'a');
  assert.ok(size.width < 2000);
});

test('moveWidget updates only the targeted widget and clamps negatives', () => {
  const layout = createDefaultLayout(false);
  const target = layout.widgets[0];
  const moved = moveWidget(layout, target.id, -20, 50);
  const updated = moved.widgets.find((w) => w.id === target.id);
  assert.equal(updated.x, 0);
  assert.equal(updated.y, 50);
  const other = moved.widgets.find((w) => w.id !== target.id);
  const originalOther = layout.widgets.find((w) => w.id === other.id);
  assert.deepEqual(other, originalOther);
});

test('resizeWidget respects the minimum size for that widget type', () => {
  const layout = createDefaultLayout(false);
  const target = layout.widgets.find((w) => w.type === 'combat');
  const resized = resizeWidget(layout, target.id, 10, 10);
  const updated = resized.widgets.find((w) => w.id === target.id);
  assert.equal(updated.width, WIDGET_TYPES.combat.minWidth);
  assert.equal(updated.height, WIDGET_TYPES.combat.minHeight);
});

test('setWidgetColor only touches the targeted widget', () => {
  const layout = createDefaultLayout(false);
  const target = layout.widgets[0];
  const recolored = setWidgetColor(layout, target.id, '#ff0000');
  assert.equal(recolored.widgets.find((w) => w.id === target.id).color, '#ff0000');
});

test('setWidgetPage refuses to move a widget to a page that does not exist', () => {
  const layout = createDefaultLayout(false);
  const target = layout.widgets[0];
  const result = setWidgetPage(layout, target.id, 'nonexistent');
  assert.equal(result.widgets.find((w) => w.id === target.id).page, target.page);
});

test('setWidgetPage moves a widget to a real page', () => {
  let layout = createDefaultLayout(false);
  layout = addPage(layout, 'Spells');
  const newPageId = layout.pages[1].id;
  const target = layout.widgets[0];
  const result = setWidgetPage(layout, target.id, newPageId);
  assert.equal(result.widgets.find((w) => w.id === target.id).page, newPageId);
});

test('addPage appends a new page without disturbing existing widgets', () => {
  const layout = createDefaultLayout(false);
  const before = layout.widgets.length;
  const result = addPage(layout, 'Notes');
  assert.equal(result.pages.length, 2);
  assert.equal(result.widgets.length, before);
});

test('renamePage only renames the targeted page', () => {
  let layout = createDefaultLayout(false);
  layout = addPage(layout, 'Notes');
  const id = layout.pages[1].id;
  const renamed = renamePage(layout, id, 'Journal');
  assert.equal(renamed.pages.find((p) => p.id === id).name, 'Journal');
  assert.equal(renamed.pages[0].name, layout.pages[0].name);
});

test('deletePage reassigns orphaned widgets to the first remaining page', () => {
  let layout = createDefaultLayout(false);
  layout = addPage(layout, 'Notes');
  const newPageId = layout.pages[1].id;
  const target = layout.widgets[0];
  layout = setWidgetPage(layout, target.id, newPageId);

  const result = deletePage(layout, newPageId);
  assert.equal(result.pages.length, 1);
  assert.equal(result.widgets.find((w) => w.id === target.id).page, result.pages[0].id);
});

test('deletePage refuses to delete the last remaining page', () => {
  const layout = createDefaultLayout(false);
  const result = deletePage(layout, layout.pages[0].id);
  assert.equal(result.pages.length, 1);
});
