import type { AuthoringDocumentKind } from '../../src/index.js';

/**
 * Draft paths address a value inside one document's draft with dot and index
 * notation: `characters[0].position.x`. They are the single addressing scheme
 * for form fields, canvas selection, undo labels, and problem navigation.
 */
export type PathSegment = number | string;

export function parsePath(path: string): PathSegment[] {
  const segments: PathSegment[] = [];
  const pattern = /([^.[\]]+)|\[(\d+)\]/g;
  for (const match of path.matchAll(pattern)) {
    if (match[2] !== undefined) segments.push(Number(match[2]));
    else if (match[1] !== undefined) segments.push(match[1]);
  }
  return segments;
}

export function formatPath(segments: readonly PathSegment[]): string {
  let path = '';
  for (const segment of segments) {
    path += typeof segment === 'number' ? `[${segment}]` : path === '' ? segment : `.${segment}`;
  }
  return path;
}

export function joinPath(base: string, child: string): string {
  if (base === '') return child;
  if (child === '') return base;
  return child.startsWith('[') ? `${base}${child}` : `${base}.${child}`;
}

function segmentsOf(path: string | readonly PathSegment[]): readonly PathSegment[] {
  return typeof path === 'string' ? parsePath(path) : path;
}

export function getAtPath(value: unknown, path: string | readonly PathSegment[]): unknown {
  let current: unknown = value;
  for (const segment of segmentsOf(path)) {
    if (current === null || typeof current !== 'object') return undefined;
    current = (current as Record<PathSegment, unknown>)[segment];
  }
  return current;
}

function cloneContainer(value: unknown, segment: PathSegment): Record<PathSegment, unknown> {
  if (Array.isArray(value)) return [...value] as unknown as Record<PathSegment, unknown>;
  if (value !== null && typeof value === 'object') {
    return { ...(value as Record<string, unknown>) };
  }
  return typeof segment === 'number'
    ? ([] as unknown as Record<PathSegment, unknown>)
    : ({} as Record<PathSegment, unknown>);
}

/** Return a copy of `value` with `next` at `path`; containers along the path are copied, everything else is shared. */
export function setAtPath<Value>(
  value: Value,
  path: string | readonly PathSegment[],
  next: unknown,
): Value {
  const segments = segmentsOf(path);
  if (segments.length === 0) return next as Value;
  const [head, ...rest] = segments;
  if (head === undefined) return value;
  const container = cloneContainer(value, head);
  container[head] = setAtPath(container[head], rest, next);
  return container as unknown as Value;
}

/** Return a copy of `value` without the entry at `path` (array entries are spliced out). */
export function removeAtPath<Value>(value: Value, path: string | readonly PathSegment[]): Value {
  const segments = segmentsOf(path);
  const last = segments.at(-1);
  if (last === undefined) return value;
  const parentPath = segments.slice(0, -1);
  const parent = getAtPath(value, parentPath);
  if (Array.isArray(parent) && typeof last === 'number') {
    return setAtPath(
      value,
      parentPath,
      parent.filter((_item, index) => index !== last),
    );
  }
  if (parent !== null && typeof parent === 'object') {
    const { [last]: _removed, ...remaining } = parent as Record<PathSegment, unknown>;
    return setAtPath(value, parentPath, remaining);
  }
  return value;
}

/** Return a copy of `value` with `item` inserted into the array at `path` (appended when `index` is omitted). */
export function insertAtPath<Value>(
  value: Value,
  path: string | readonly PathSegment[],
  item: unknown,
  index?: number,
): Value {
  const existing = getAtPath(value, path);
  const list = Array.isArray(existing) ? [...existing] : [];
  list.splice(index ?? list.length, 0, item);
  return setAtPath(value, path, list);
}

export function pathStartsWith(path: string, prefix: string): boolean {
  if (prefix === '') return true;
  if (path === prefix) return true;
  return path.startsWith(prefix) && /^[.[]/.test(path.slice(prefix.length));
}

/**
 * Map a diagnostic's authored path onto a draft path for editors.
 * Scenario diagnostics are rooted at `scenario`; resource diagnostics at
 * `resource`; a diagnostic rooted at the document identity has no draft path.
 */
export function draftPathFromDiagnostic(
  kind: AuthoringDocumentKind,
  diagnosticPath: string,
): string | null {
  const root = kind === 'scenario' ? 'scenario' : 'resource';
  if (diagnosticPath === root) return '';
  if (diagnosticPath.startsWith(`${root}.`)) return diagnosticPath.slice(root.length + 1);
  if (diagnosticPath.startsWith(`${root}[`)) return diagnosticPath.slice(root.length);
  return null;
}

export function documentIdFromAddress(address: {
  kind: string;
  packageId: string;
  resourceId: string;
}): string {
  return `${address.packageId}:${address.kind}:${address.resourceId}`;
}

export function addressFromDocumentId(
  documentId: string,
): { kind: string; packageId: string; resourceId: string } | null {
  const [packageId, kind, ...rest] = documentId.split(':');
  if (packageId === undefined || kind === undefined || rest.length === 0) return null;
  return { kind, packageId, resourceId: rest.join(':') };
}
