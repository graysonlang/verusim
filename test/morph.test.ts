import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { type MorphNode, morphChildren } from '../app/morph.js';

/** The subset of the DOM the reconciler relies on, enough to prove identity preservation. */
class FakeNode implements MorphNode {
  readonly childNodes: FakeNode[] = [];
  readonly nodeName: string;
  readonly nodeType: number;
  nodeValue: string | null;
  checked?: boolean;
  selected?: boolean;
  value?: string;
  private readonly attributes = new Map<string, string>();

  constructor(name: string, text?: string) {
    if (text !== undefined) {
      this.nodeName = '#text';
      this.nodeType = 3;
      this.nodeValue = text;
    } else {
      this.nodeName = name.toUpperCase();
      this.nodeType = 1;
      this.nodeValue = null;
    }
  }

  append(...nodes: FakeNode[]): this {
    this.childNodes.push(...nodes);
    return this;
  }

  attr(name: string, value: string): this {
    this.attributes.set(name, value);
    return this;
  }

  appendChild(node: MorphNode): void {
    this.childNodes.push(node as FakeNode);
  }

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }

  getAttributeNames(): string[] {
    return [...this.attributes.keys()];
  }

  isEqualNode(other: MorphNode | null): boolean {
    if (!(other instanceof FakeNode)) return false;
    if (this.nodeType !== other.nodeType || this.nodeName !== other.nodeName) return false;
    if (this.nodeType === 3) return this.nodeValue === other.nodeValue;
    if (this.attributes.size !== other.attributes.size) return false;
    for (const [name, value] of this.attributes) {
      if (other.attributes.get(name) !== value) return false;
    }
    if (this.childNodes.length !== other.childNodes.length) return false;
    return this.childNodes.every((child, index) =>
      child.isEqualNode(other.childNodes[index] ?? null),
    );
  }

  removeAttribute(name: string): void {
    this.attributes.delete(name);
  }

  removeChild(node: MorphNode): void {
    const index = this.childNodes.indexOf(node as FakeNode);
    if (index >= 0) this.childNodes.splice(index, 1);
  }

  replaceChild(node: MorphNode, existing: MorphNode): void {
    const index = this.childNodes.indexOf(existing as FakeNode);
    if (index >= 0) this.childNodes[index] = node as FakeNode;
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  text(): string {
    return this.nodeType === 3
      ? (this.nodeValue ?? '')
      : this.childNodes.map(child => child.text()).join('');
  }
}

const el = (name: string, ...children: FakeNode[]): FakeNode =>
  new FakeNode(name).append(...children);
const text = (value: string): FakeNode => new FakeNode('', value);

function section(title: string, ...body: FakeNode[]): FakeNode {
  return el('section', el('h3', text(title)), el('div', ...body));
}

function rangeInput(value: string, label: string): FakeNode {
  const input = el('input').attr('type', 'range').attr('aria-label', label).attr('value', value);
  input.value = value;
  return input;
}

describe('in-place DOM reconciliation', () => {
  it('keeps existing nodes and patches only the text that changed', () => {
    const container = el('div');
    morphChildren(container, [section('Mind', text('valence 0.10')), section('Trace', text('a'))]);
    const [mind, trace] = container.childNodes;
    assert.ok(mind && trace);
    const mindText = mind.childNodes[1]?.childNodes[0];
    assert.ok(mindText);

    morphChildren(container, [section('Mind', text('valence 0.20')), section('Trace', text('a'))]);
    assert.equal(container.childNodes[0], mind, 'section node identity is kept');
    assert.equal(container.childNodes[1], trace);
    assert.equal(mind.childNodes[1]?.childNodes[0], mindText, 'text node identity is kept');
    assert.equal(mind.text(), 'Mindvalence 0.20');
  });

  it('updates form values and attributes in place except on the active control', () => {
    const container = el('div');
    morphChildren(container, [
      section('Values', rangeInput('0.10', 'respect charge'), rangeInput('0.50', 'safety charge')),
    ]);
    const body = container.childNodes[0]?.childNodes[1];
    const [respect, safety] = body?.childNodes ?? [];
    assert.ok(respect && safety);

    morphChildren(
      container,
      [
        section(
          'Values',
          rangeInput('0.30', 'respect charge'),
          rangeInput('0.70', 'safety charge'),
        ),
      ],
      { isActive: node => node === respect },
    );
    assert.equal(container.childNodes[0]?.childNodes[1]?.childNodes[0], respect);
    assert.equal(respect.value, '0.10', 'the focused control keeps its live value');
    assert.equal(safety.value, '0.70', 'other controls take the rendered value');

    const relabeled = rangeInput('0.30', 'respect charge');
    relabeled.attr('data-intervention', 'value');
    morphChildren(container, [section('Values', relabeled, rangeInput('0.70', 'safety charge'))]);
    assert.equal(respect.getAttribute('data-intervention'), 'value');
    assert.equal(respect.value, '0.30');
  });

  it('protects descendants of the active element and replaces nodes of a different kind', () => {
    const container = el('div');
    const option = (id: string, selected: boolean): FakeNode => {
      const node = el('option', text(id)).attr('value', id);
      if (selected) node.attr('selected', '');
      node.selected = selected;
      return node;
    };
    morphChildren(container, [el('select', option('a', true), option('b', false))]);
    const select = container.childNodes[0];
    assert.ok(select);
    morphChildren(container, [el('select', option('a', false), option('b', true))], {
      isActive: node => node === select,
    });
    assert.equal(select.childNodes[0]?.selected, true, 'an open select keeps its options');
    morphChildren(container, [el('select', option('a', false), option('b', true))]);
    assert.equal(select.childNodes[1]?.selected, true);

    morphChildren(container, [el('p', text('empty'))]);
    assert.equal(container.childNodes[0]?.nodeName, 'P');
    assert.equal(container.childNodes.length, 1);
  });

  it('appends and removes trailing children to match the rendered list', () => {
    const container = el('div');
    morphChildren(container, [el('li', text('1')), el('li', text('2')), el('li', text('3'))]);
    const first = container.childNodes[0];
    morphChildren(container, [el('li', text('1'))]);
    assert.equal(container.childNodes.length, 1);
    assert.equal(container.childNodes[0], first);
    morphChildren(container, [el('li', text('1')), el('li', text('4'))]);
    assert.equal(container.childNodes.length, 2);
    assert.equal(container.childNodes[0], first);
    assert.equal(container.childNodes[1]?.text(), '4');
  });
});
