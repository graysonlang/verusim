/**
 * In-place DOM reconciliation for panels that are re-rendered from state.
 *
 * `morphChildren` patches an existing container so it matches a freshly built
 * list of children while keeping the existing nodes wherever their tag and
 * position match. Kept nodes retain focus, scroll position, text selection,
 * and any in-progress edit, and subtrees that are already equal are skipped
 * without being rebuilt.
 *
 * The functions take a structural view of nodes so the algorithm can be tested
 * without a browser; the real DOM satisfies `MorphNode` directly.
 */

export interface MorphNode {
  readonly childNodes: ArrayLike<MorphNode>;
  readonly nodeName: string;
  readonly nodeType: number;
  nodeValue: string | null;
  appendChild(node: MorphNode): unknown;
  isEqualNode(other: MorphNode | null): boolean;
  removeChild(node: MorphNode): unknown;
  replaceChild(node: MorphNode, existing: MorphNode): unknown;
}

/** Element nodes additionally expose attributes; live form state is mirrored into attributes by builders. */
export interface MorphElement extends MorphNode {
  getAttribute(name: string): string | null;
  getAttributeNames(): string[];
  removeAttribute(name: string): void;
  setAttribute(name: string, value: string): void;
}

interface FormControl {
  checked?: boolean;
  selected?: boolean;
  value?: string;
}

export interface MorphOptions {
  /**
   * Nodes whose live state must not be overwritten, such as the focused control.
   * An active node and its descendants are left untouched entirely - attributes
   * included - so the next pass after it stops being active sees the difference
   * and brings the whole subtree back in line.
   */
  isActive?: (node: MorphNode) => boolean;
}

const ELEMENT_NODE = 1;
const TEXT_NODE = 3;

function sameKind(left: MorphNode, right: MorphNode): boolean {
  return left.nodeType === right.nodeType && left.nodeName === right.nodeName;
}

function morphAttributes(existing: MorphElement, fresh: MorphElement): void {
  for (const name of fresh.getAttributeNames()) {
    const value = fresh.getAttribute(name);
    if (value !== null && existing.getAttribute(name) !== value) existing.setAttribute(name, value);
  }
  for (const name of existing.getAttributeNames()) {
    if (fresh.getAttribute(name) === null) existing.removeAttribute(name);
  }
}

function morphFormState(existing: MorphNode, fresh: MorphNode): void {
  const target = existing as unknown as FormControl;
  const source = fresh as unknown as FormControl;
  if (source.value !== undefined && target.value !== source.value) target.value = source.value;
  if (source.checked !== undefined && target.checked !== source.checked) {
    target.checked = source.checked;
  }
  if (source.selected !== undefined && target.selected !== source.selected) {
    target.selected = source.selected;
  }
}

function morphNode(existing: MorphNode, fresh: MorphNode, options: MorphOptions): void {
  if (existing.nodeType === TEXT_NODE) {
    if (existing.nodeValue !== fresh.nodeValue) existing.nodeValue = fresh.nodeValue;
    return;
  }
  if (existing.nodeType !== ELEMENT_NODE) return;
  if (options.isActive?.(existing) ?? false) return;
  // Builders mirror live form state into attributes, so equal markup means an
  // equal subtree and it is left untouched.
  if (existing.isEqualNode(fresh)) return;
  morphAttributes(existing as MorphElement, fresh as MorphElement);
  morphFormState(existing, fresh);
  morphChildren(existing, Array.from(fresh.childNodes), options);
}

/** Patch `container`'s children to match `fresh`, keeping matching existing nodes. */
export function morphChildren(
  container: MorphNode,
  fresh: readonly MorphNode[],
  options: MorphOptions = {},
): void {
  const existing = Array.from(container.childNodes);
  for (let index = 0; index < fresh.length; index += 1) {
    const next = fresh[index];
    if (next === undefined) continue;
    const current = existing[index];
    if (current === undefined) {
      container.appendChild(next);
      continue;
    }
    if (sameKind(current, next)) {
      morphNode(current, next, options);
      continue;
    }
    container.replaceChild(next, current);
  }
  for (let index = existing.length - 1; index >= fresh.length; index -= 1) {
    const extra = existing[index];
    if (extra !== undefined) container.removeChild(extra);
  }
}

/** The document's focused element, or null outside a browser. */
export function activeDocumentElement(): MorphNode | null {
  return typeof document === 'undefined'
    ? null
    : (document.activeElement as unknown as MorphNode | null);
}
