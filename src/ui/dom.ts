export function byId(id: string): HTMLElement;
export function byId<T extends HTMLElement>(id: string, kind: new () => T): T;
export function byId(id: string, kind: new () => HTMLElement = HTMLElement): HTMLElement {
  const el = document.getElementById(id);
  if (!(el instanceof kind)) throw new Error(`Missing element #${id}`);
  return el;
}

export function svgById(id: string): SVGElement {
  const el = document.getElementById(id);
  if (!(el instanceof SVGElement)) throw new Error(`Missing element #${id}`);
  return el;
}

type Child = Node | string | null | undefined | false;

export interface ElementProps {
  className?: string;
  text?: string;
  attrs?: Record<string, string>;
  style?: Partial<Record<'left' | 'top' | 'width' | 'height' | 'transform', string>>;
}

/** Builds DOM nodes; text is always assigned via textContent so user data is never parsed as HTML. */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: ElementProps = {},
  children: readonly Child[] = [],
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (props.className) el.className = props.className;
  if (props.text !== undefined) el.textContent = props.text;
  for (const [k, v] of Object.entries(props.attrs ?? {})) el.setAttribute(k, v);
  Object.assign(el.style, props.style ?? {});
  for (const child of children) {
    if (child) el.append(child);
  }
  return el;
}

const SVG_NS = 'http://www.w3.org/2000/svg';

export function svg<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number> = {},
): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  return el;
}

export const icon = (className: string): HTMLElement => h('i', { className, attrs: { 'aria-hidden': 'true' } });

export function clear(el: Element): void {
  el.replaceChildren();
}
