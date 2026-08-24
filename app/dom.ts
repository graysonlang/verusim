export function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className !== undefined) node.className = className;
  return node;
}

export function button(label: string, className = 'button'): HTMLButtonElement {
  const node = element('button', className);
  node.type = 'button';
  node.textContent = label;
  return node;
}

export function menuAction(label: string, actionId?: string, shortcut?: string): HTMLButtonElement {
  const control = button('', 'menu-item');
  const copy = element('span');
  copy.textContent = label;
  control.append(copy);
  if (actionId !== undefined) control.dataset.action = actionId;
  if (shortcut !== undefined) {
    const key = element('kbd');
    key.textContent = shortcut;
    control.append(key);
  }
  return control;
}

export function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
