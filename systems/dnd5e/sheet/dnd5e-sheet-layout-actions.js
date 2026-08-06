/**
 * Dnd5eSheetLayoutActions - "Edit Layout" mode: drag, resize, recolor, and
 * move widgets between pages on the free-form character sheet canvas.
 * All persisted geometry math lives in sheet-layout-manager.js; this file
 * only wires DOM pointer events and Foundry actions to it.
 */
import {
  normalizeLayout, moveWidget, resizeWidget, setWidgetColor, setWidgetPage,
  addPage, renamePage, deletePage, resetLayout, WIDGET_TYPES
} from './sheet-layout-manager.js';

export const Dnd5eSheetLayoutActions = (Base) => class extends Base {

  async _getLayout() {
    return normalizeLayout(this.actor.getFlag('ld-axyum', 'sheetLayout'), this._prepareSpells().caster);
  }

  async _mutateLayout(mutator) {
    const layout = await this._getLayout();
    const updated = mutator(layout);
    await this.actor.setFlag('ld-axyum', 'sheetLayout', updated);
    this.render();
  }

  // ===== EDIT MODE / PAGE ACTIONS =====

  async onToggleEditMode() {
    this.editMode = !this.editMode;
    this.render();
  }

  async onSwitchPage(event, target) {
    const pageId = target.dataset.pageId;
    if (pageId) {
      this.currentPageId = pageId;
      this.render();
    }
  }

  async onAddPage() {
    const name = await foundry.applications.api.DialogV2.prompt({
      window: { title: 'New Page' },
      content: '<div style="margin:0.5rem 0;"><input type="text" id="ld-axyum-page-name" placeholder="Page name" style="width:100%;padding:0.5rem;"></div>',
      ok: {
        label: 'Create',
        callback: (event, button) => button.form.elements['ld-axyum-page-name']?.value?.trim() || null
      },
      rejectClose: false
    });
    if (!name) return;
    await this._mutateLayout((layout) => {
      const updated = addPage(layout, name);
      this.currentPageId = updated.pages[updated.pages.length - 1].id;
      return updated;
    });
  }

  async onRenamePage(event, target) {
    const pageId = target.dataset.pageId || this.currentPageId;
    const layout = await this._getLayout();
    const page = layout.pages.find((p) => p.id === pageId);
    const name = await foundry.applications.api.DialogV2.prompt({
      window: { title: 'Rename Page' },
      content: `<div style="margin:0.5rem 0;"><input type="text" id="ld-axyum-page-name" value="${page?.name ?? ''}" style="width:100%;padding:0.5rem;"></div>`,
      ok: {
        label: 'Rename',
        callback: (event, button) => button.form.elements['ld-axyum-page-name']?.value?.trim() || null
      },
      rejectClose: false
    });
    if (!name) return;
    await this._mutateLayout((l) => renamePage(l, pageId, name));
  }

  async onDeletePage(event, target) {
    const pageId = target.dataset.pageId || this.currentPageId;
    const layout = await this._getLayout();
    if (layout.pages.length <= 1) {
      ui.notifications?.warn?.('You need at least one page.');
      return;
    }
    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: 'Delete Page' },
      content: '<p>Delete this page? Its widgets move to the first remaining page — nothing is lost.</p>'
    });
    if (!confirmed) return;
    await this._mutateLayout((l) => {
      const updated = deletePage(l, pageId);
      if (this.currentPageId === pageId) this.currentPageId = updated.pages[0].id;
      return updated;
    });
  }

  async onResetLayout() {
    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: 'Reset Layout' },
      content: '<p>Reset this sheet to the default layout? Your custom positions, sizes, colors, and pages will be lost.</p>'
    });
    if (!confirmed) return;
    await this._mutateLayout(() => {
      const fresh = resetLayout(this._prepareSpells().caster);
      this.currentPageId = fresh.pages[0].id;
      return fresh;
    });
  }

  async onSetWidgetColor(event, target) {
    const widgetId = target.dataset.widgetId;
    const input = document.createElement('input');
    input.type = 'color';
    const layout = await this._getLayout();
    input.value = layout.widgets.find((w) => w.id === widgetId)?.color || '#7dd3fc';
    input.addEventListener('change', async () => {
      await this._mutateLayout((l) => setWidgetColor(l, widgetId, input.value));
    });
    input.click();
  }

  /** Small dropdown for moving a widget to a different page. */
  async onMovePageMenu(event, target) {
    const widgetId = target.dataset.widgetId;
    const layout = await this._getLayout();
    const widget = layout.widgets.find((w) => w.id === widgetId);
    if (!widget) return;

    const options = layout.pages
      .map((p) => `<option value="${p.id}" ${p.id === widget.page ? 'selected' : ''}>${p.name}</option>`)
      .join('');

    const pageId = await foundry.applications.api.DialogV2.prompt({
      window: { title: `Move "${WIDGET_TYPES[widget.type]?.label ?? widget.type}" to page` },
      content: `<div style="margin:0.5rem 0;"><select id="ld-axyum-page-select" style="width:100%;padding:0.5rem;">${options}</select></div>`,
      ok: {
        label: 'Move',
        callback: (event, button) => button.form.elements['ld-axyum-page-select']?.value || null
      },
      rejectClose: false
    });
    if (!pageId || pageId === widget.page) return;
    await this._mutateLayout((l) => setWidgetPage(l, widgetId, pageId));
    this.currentPageId = pageId;
    this.render();
  }

  // ===== DRAG / RESIZE (pointer-based, only active in edit mode) =====

  _onRender(context, options) {
    super._onRender?.(context, options);
    if (this.editMode) this._setupWidgetInteractions();
  }

  _setupWidgetInteractions() {
    const canvas = this.element?.querySelector('.axyum-canvas');
    if (!canvas) return;

    canvas.querySelectorAll('.axyum-widget').forEach((el) => {
      const widgetId = el.dataset.widgetId;
      const dragHandle = el.querySelector('.widget-drag-handle');
      const resizeHandle = el.querySelector('.widget-resize-handle');

      if (dragHandle) {
        dragHandle.addEventListener('pointerdown', (event) => this._startWidgetDrag(event, el, widgetId));
      }
      if (resizeHandle) {
        resizeHandle.addEventListener('pointerdown', (event) => this._startWidgetResize(event, el, widgetId));
      }
    });
  }

  _startWidgetDrag(event, el, widgetId) {
    if (event.button !== 0) return;
    event.preventDefault();
    const startX = event.clientX;
    const startY = event.clientY;
    const origX = parseFloat(el.style.left) || 0;
    const origY = parseFloat(el.style.top) || 0;
    el.classList.add('is-dragging');

    const onMove = (moveEvent) => {
      const newX = Math.max(0, origX + (moveEvent.clientX - startX));
      const newY = Math.max(0, origY + (moveEvent.clientY - startY));
      el.style.left = `${newX}px`;
      el.style.top = `${newY}px`;
    };

    const onUp = async () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      el.classList.remove('is-dragging');
      const finalX = parseFloat(el.style.left) || 0;
      const finalY = parseFloat(el.style.top) || 0;
      await this._mutateLayout((layout) => moveWidget(layout, widgetId, finalX, finalY));
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp, { once: true });
  }

  _startWidgetResize(event, el, widgetId) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;
    const startY = event.clientY;
    const origW = el.offsetWidth;
    const origH = el.offsetHeight;
    el.classList.add('is-resizing');

    const onMove = (moveEvent) => {
      const newW = Math.max(150, origW + (moveEvent.clientX - startX));
      const newH = Math.max(100, origH + (moveEvent.clientY - startY));
      el.style.width = `${newW}px`;
      el.style.height = `${newH}px`;
    };

    const onUp = async () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      el.classList.remove('is-resizing');
      await this._mutateLayout((layout) => resizeWidget(layout, widgetId, el.offsetWidth, el.offsetHeight));
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp, { once: true });
  }
};
