import { button, element } from '../dom.js';
import { activeDocumentElement, morphChildren } from '../morph.js';
import {
  type FieldSpec,
  type FormSpec,
  type ListSpec,
  fieldValueFromInput,
  inputValueForField,
  joinFieldPath,
} from './forms.js';
import { getAtPath, pathStartsWith } from './paths.js';

/**
 * Renders a form specification against a draft and turns every change into one
 * path edit. Controls are native inputs so keyboard navigation is the browser's;
 * the view is reconciled in place so focus, expanded items, and scroll survive
 * re-renders, and a problem reported at an authored path is shown on the field
 * that owns it (or on the nearest enclosing item when no field owns it).
 */
export interface FormProblem {
  message: string;
  /** Draft-relative path. */
  path: string;
}

export interface FormHandlers {
  onInsert: (listPath: string, item: unknown, label: string) => void;
  onMove: (listPath: string, from: number, to: number, label: string) => void;
  onNavigate: (documentId: string) => void;
  onRemove: (path: string, label: string) => void;
  onRemoveValue: (path: string, label: string) => void;
  onSelectPath: (path: string | null) => void;
  onSetValue: (path: string, value: unknown, label: string) => void;
}

export interface FormRenderOptions {
  draft: unknown;
  problems: readonly FormProblem[];
  selectedPath: string | null;
  spec: FormSpec;
}

export interface FormView {
  element: HTMLElement;
  render: (options: FormRenderOptions) => void;
}

const LIVE_CONTROL_TAGS = new Set(['INPUT', 'SELECT', 'TEXTAREA']);

interface RenderedField {
  field: FieldSpec;
  path: string;
}

interface RenderedList {
  base: string;
  list: ListSpec;
  path: string;
}

export function createFormView(handlers: FormHandlers): FormView {
  const container = element('div', 'form-view');
  container.dataset.testid = 'build-form';
  const openItems = new Set<string>();
  let fieldsByPath = new Map<string, RenderedField>();
  let listsByPath = new Map<string, RenderedList>();
  let lastSelectedPath: string | null = null;

  container.addEventListener('change', event => {
    const target = event.target;
    if (
      !(
        target instanceof HTMLInputElement ||
        target instanceof HTMLSelectElement ||
        target instanceof HTMLTextAreaElement
      )
    ) {
      return;
    }
    const path = target.dataset.path;
    if (path === undefined) return;
    const rendered = fieldsByPath.get(path);
    if (rendered === undefined || rendered.field.readOnly === true) return;
    const checked =
      target instanceof HTMLInputElement && target.type === 'checkbox' && target.checked;
    const { remove, value } = fieldValueFromInput(rendered.field, target.value, checked);
    if (remove) {
      handlers.onRemoveValue(path, `Clear ${rendered.field.label}`);
      return;
    }
    if (value === undefined) return;
    handlers.onSetValue(path, value, `Set ${rendered.field.label}`);
  });
  container.addEventListener('click', event => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const control = target.closest<HTMLElement>('[data-action]');
    if (control === null) return;
    const { action, listPath, itemPath, index, navigate } = control.dataset;
    switch (action) {
      case 'navigate': {
        if (navigate !== undefined) handlers.onNavigate(navigate);
        return;
      }
      case 'insert': {
        const rendered = listPath === undefined ? undefined : listsByPath.get(listPath);
        if (rendered === undefined) return;
        // The handler re-renders synchronously, so mark the new item open first.
        openItems.add(`${rendered.path}[${arrayLength(rendered)}]`);
        handlers.onInsert(rendered.path, rendered.list.template(), `Add ${rendered.list.title}`);
        return;
      }
      case 'remove': {
        if (itemPath !== undefined) handlers.onRemove(itemPath, `Remove ${itemPath}`);
        return;
      }
      case 'move-up':
      case 'move-down': {
        const rendered = listPath === undefined ? undefined : listsByPath.get(listPath);
        const from = Number(index);
        if (rendered === undefined || !Number.isInteger(from)) return;
        const to = action === 'move-up' ? from - 1 : from + 1;
        if (to < 0) return;
        openItems.delete(`${rendered.path}[${from}]`);
        openItems.add(`${rendered.path}[${to}]`);
        handlers.onMove(rendered.path, from, to, `Reorder ${rendered.list.title}`);
        return;
      }
      default:
        return;
    }
  });
  container.addEventListener('focusin', event => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const path =
      target.dataset.path ?? target.closest<HTMLElement>('[data-item-path]')?.dataset.itemPath;
    if (path !== undefined) handlers.onSelectPath(path);
  });
  container.addEventListener('toggle', event => {
    const target = event.target;
    if (!(target instanceof HTMLDetailsElement)) return;
    const path = target.dataset.itemPath;
    if (path === undefined) return;
    if (target.open) openItems.add(path);
    else openItems.delete(path);
  });

  let currentDraft: unknown;
  const arrayLength = (rendered: RenderedList): number => {
    const items = getAtPath(currentDraft, rendered.path);
    return Array.isArray(items) ? items.length : 0;
  };

  function fieldControl(rendered: RenderedField, value: unknown): HTMLElement {
    const { field, path } = rendered;
    const shown = inputValueForField(field, value);
    if (field.kind === 'textarea') {
      const control = element('textarea');
      control.rows = 3;
      control.dataset.path = path;
      control.value = shown;
      control.textContent = shown;
      control.readOnly = field.readOnly === true;
      control.setAttribute('aria-label', field.label);
      return control;
    }
    if (field.kind === 'enum' || field.kind === 'reference') {
      const control = element('select');
      control.dataset.path = path;
      control.disabled = field.readOnly === true;
      control.setAttribute('aria-label', field.label);
      const known = field.options?.some(option => option.value === shown) ?? false;
      if (!known) {
        const option = element('option');
        option.value = shown;
        option.textContent = shown === '' ? '(unset)' : `${shown} (unknown)`;
        option.selected = true;
        option.setAttribute('selected', '');
        control.append(option);
      }
      for (const candidate of field.options ?? []) {
        const option = element('option');
        option.value = candidate.value;
        option.textContent = candidate.label;
        option.selected = candidate.value === shown;
        if (option.selected) option.setAttribute('selected', '');
        control.append(option);
      }
      return control;
    }
    const control = element('input');
    control.dataset.path = path;
    control.readOnly = field.readOnly === true;
    control.setAttribute('aria-label', field.label);
    if (field.kind === 'boolean') {
      control.type = 'checkbox';
      control.checked = value === true;
      if (control.checked) control.setAttribute('checked', '');
      return control;
    }
    control.type = field.kind === 'integer' || field.kind === 'number' ? 'number' : 'text';
    if (field.min !== undefined) control.min = String(field.min);
    if (field.max !== undefined) control.max = String(field.max);
    if (field.step !== undefined) control.step = String(field.step);
    control.value = shown;
    control.setAttribute('value', shown);
    if (field.optional) control.placeholder = 'unset';
    return control;
  }

  function renderField(
    rendered: RenderedField,
    draft: unknown,
    problems: readonly FormProblem[],
  ): HTMLElement {
    const wrapper = element('label', 'form-field');
    const label = element('span', 'form-field-label');
    label.textContent = rendered.field.label;
    const control = fieldControl(rendered, getAtPath(draft, rendered.path));
    wrapper.dataset.fieldPath = rendered.path;
    wrapper.append(label, control);
    if (rendered.field.kind === 'reference') {
      const open = button('Open', 'button subtle form-open-reference');
      open.dataset.action = 'navigate';
      open.dataset.navigate = inputValueForField(rendered.field, getAtPath(draft, rendered.path));
      open.title = 'Open the referenced document';
      wrapper.append(open);
    }
    const owned = problems.filter(problem => problem.path === rendered.path);
    if (owned.length > 0) {
      control.setAttribute('aria-invalid', 'true');
      const message = element('small', 'form-field-problem');
      message.textContent = owned.map(problem => problem.message).join(' / ');
      wrapper.append(message);
    }
    return wrapper;
  }

  function renderGroups(
    groups: readonly FormSpec['groups'][number][],
    base: string,
    draft: unknown,
    problems: readonly FormProblem[],
  ): HTMLElement[] {
    return groups.map(group => {
      const section = element('section', 'form-group');
      const heading = element('h3');
      heading.textContent = group.title;
      const grid = element('div', 'form-grid');
      for (const field of group.fields) {
        const rendered = { field, path: joinFieldPath(base, field.path) };
        fieldsByPath.set(rendered.path, rendered);
        grid.append(renderField(rendered, draft, problems));
      }
      section.append(heading, grid);
      return section;
    });
  }

  function renderLists(
    lists: readonly ListSpec[],
    base: string,
    draft: unknown,
    problems: readonly FormProblem[],
    fieldPaths: Set<string>,
  ): HTMLElement[] {
    return lists.map(list => {
      const listPath = joinFieldPath(base, list.path);
      listsByPath.set(listPath, { base, list, path: listPath });
      const section = element('section', 'form-list');
      section.dataset.listPath = listPath;
      const header = element('div', 'form-list-header');
      const heading = element('h3');
      const add = button(`Add ${list.title.toLowerCase()}`, 'button subtle');
      add.dataset.action = 'insert';
      add.dataset.listPath = listPath;
      const items = getAtPath(draft, listPath);
      const entries = Array.isArray(items) ? items : [];
      heading.textContent = `${list.title} (${entries.length})`;
      header.append(heading, add);
      section.append(header);
      entries.forEach((item, index) => {
        const itemPath = `${listPath}[${index}]`;
        const details = element('details', 'form-item');
        details.dataset.itemPath = itemPath;
        if (openItems.has(itemPath)) {
          details.open = true;
          details.setAttribute('open', '');
        }
        const summary = element('summary');
        const title = element('span', 'form-item-title');
        title.textContent = list.itemLabel(item, index);
        const tools = element('span', 'form-item-tools');
        const up = button('Up', 'button subtle');
        up.dataset.action = 'move-up';
        up.dataset.listPath = listPath;
        up.dataset.index = String(index);
        up.disabled = index === 0;
        const down = button('Down', 'button subtle');
        down.dataset.action = 'move-down';
        down.dataset.listPath = listPath;
        down.dataset.index = String(index);
        down.disabled = index === entries.length - 1;
        const remove = button('Remove', 'button subtle');
        remove.dataset.action = 'remove';
        remove.dataset.itemPath = itemPath;
        tools.append(up, down, remove);
        summary.append(title, tools);
        const body = element('div', 'form-item-body');
        body.append(
          ...renderGroups(list.groups, itemPath, draft, problems),
          ...renderLists(list.lists ?? [], itemPath, draft, problems, fieldPaths),
        );
        const itemProblems = problems.filter(
          problem => pathStartsWith(problem.path, itemPath) && !fieldPaths.has(problem.path),
        );
        if (itemProblems.length > 0) details.classList.add('has-problem');
        details.append(summary, body);
        section.append(details);
      });
      return section;
    });
  }

  return {
    element: container,
    render(options) {
      currentDraft = options.draft;
      fieldsByPath = new Map();
      listsByPath = new Map();
      const fieldPaths = new Set<string>();
      const children = [
        ...renderGroups(options.spec.groups, '', options.draft, options.problems),
        ...renderLists(options.spec.lists, '', options.draft, options.problems, fieldPaths),
      ];
      for (const path of fieldsByPath.keys()) fieldPaths.add(path);
      const orphaned = options.problems.filter(
        problem =>
          !fieldPaths.has(problem.path) &&
          ![...listsByPath.keys()].some(listPath => pathStartsWith(problem.path, listPath)),
      );
      if (orphaned.length > 0) {
        const section = element('section', 'form-group form-orphaned-problems');
        const heading = element('h3');
        heading.textContent = 'Problems outside the form';
        const list = element('ul');
        for (const problem of orphaned) {
          const item = element('li');
          item.textContent = `${problem.path === '' ? 'document' : problem.path}: ${problem.message}`;
          list.append(item);
        }
        section.append(heading, list);
        children.unshift(section);
      }
      const active = activeDocumentElement();
      morphChildren(container, children, {
        isActive: node => node === active && LIVE_CONTROL_TAGS.has(node.nodeName),
      });
      if (options.selectedPath !== lastSelectedPath) {
        lastSelectedPath = options.selectedPath;
        if (options.selectedPath !== null) revealPath(options.selectedPath);
      }
    },
  };

  /** Open the items enclosing a path and focus its control when the focus is not already inside it. */
  function revealPath(path: string): void {
    for (const details of container.querySelectorAll<HTMLDetailsElement>(
      'details[data-item-path]',
    )) {
      const itemPath = details.dataset.itemPath;
      if (itemPath !== undefined && pathStartsWith(path, itemPath) && !details.open) {
        details.open = true;
        openItems.add(itemPath);
      }
    }
    const control = container.querySelector<HTMLElement>(`[data-path="${CSS.escape(path)}"]`);
    const target =
      control ??
      container.querySelector<HTMLElement>(`[data-item-path="${CSS.escape(path)}"] summary`);
    if (target === null) return;
    const active = document.activeElement;
    if (active instanceof HTMLElement && active.dataset.path === path) return;
    target.scrollIntoView({ block: 'center' });
    if (active === null || !container.contains(active)) target.focus({ preventScroll: true });
  }
}
