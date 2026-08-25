import { handsetSheetIconPaths } from './responsive-layout.js';

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

export function hamburgerIcon(): SVGSVGElement {
  const icon = document.createElementNS(SVG_NAMESPACE, 'svg');
  const path = document.createElementNS(SVG_NAMESPACE, 'path');
  icon.classList.add('menu-icon');
  icon.setAttribute('aria-hidden', 'true');
  icon.setAttribute('height', '16');
  icon.setAttribute('viewBox', '0 0 16 16');
  icon.setAttribute('width', '16');
  path.setAttribute('d', 'M2 4h12M2 8h12M2 12h12');
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke', 'currentColor');
  path.setAttribute('stroke-linecap', 'round');
  path.setAttribute('stroke-width', '1.5');
  icon.append(path);
  return icon;
}

export function sidebarIcon(side: 'left' | 'right'): SVGSVGElement {
  const icon = document.createElementNS(SVG_NAMESPACE, 'svg');
  const frame = document.createElementNS(SVG_NAMESPACE, 'rect');
  const divider = document.createElementNS(SVG_NAMESPACE, 'path');
  icon.classList.add('control-icon');
  icon.setAttribute('aria-hidden', 'true');
  icon.setAttribute('height', '16');
  icon.setAttribute('viewBox', '0 0 16 16');
  icon.setAttribute('width', '16');
  frame.setAttribute('fill', 'none');
  frame.setAttribute('height', '12');
  frame.setAttribute('rx', '1');
  frame.setAttribute('stroke', 'currentColor');
  frame.setAttribute('stroke-width', '1.25');
  frame.setAttribute('width', '12');
  frame.setAttribute('x', '2');
  frame.setAttribute('y', '2');
  divider.setAttribute('d', side === 'left' ? 'M6 2v12' : 'M10 2v12');
  divider.setAttribute('fill', 'none');
  divider.setAttribute('stroke', 'currentColor');
  divider.setAttribute('stroke-width', '1.25');
  icon.append(frame, divider);
  return icon;
}

export function controlIcon(
  kind:
    | 'chevron'
    | 'close'
    | 'edit'
    | 'filter'
    | 'info'
    | 'pause'
    | 'play'
    | 'reset'
    | 'sheet-contract'
    | 'sheet-expand'
    | 'step',
): SVGSVGElement {
  const icon = document.createElementNS(SVG_NAMESPACE, 'svg');
  icon.classList.add('control-icon');
  icon.setAttribute('aria-hidden', 'true');
  icon.setAttribute('height', '16');
  icon.setAttribute('viewBox', '0 0 16 16');
  icon.setAttribute('width', '16');
  if (kind === 'pause') {
    for (const x of ['4', '9']) {
      const rect = document.createElementNS(SVG_NAMESPACE, 'rect');
      rect.setAttribute('fill', 'currentColor');
      rect.setAttribute('height', '10');
      rect.setAttribute('rx', '0.75');
      rect.setAttribute('width', '3');
      rect.setAttribute('x', x);
      rect.setAttribute('y', '3');
      icon.append(rect);
    }
    return icon;
  }
  if (kind === 'info') {
    const circle = document.createElementNS(SVG_NAMESPACE, 'circle');
    const path = document.createElementNS(SVG_NAMESPACE, 'path');
    circle.setAttribute('cx', '8');
    circle.setAttribute('cy', '8');
    circle.setAttribute('fill', 'none');
    circle.setAttribute('r', '6');
    circle.setAttribute('stroke', 'currentColor');
    circle.setAttribute('stroke-width', '1.25');
    path.setAttribute('d', 'M8 7v4M8 4.5v.25');
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', 'currentColor');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-width', '1.5');
    icon.append(circle, path);
    return icon;
  }
  const path = document.createElementNS(SVG_NAMESPACE, 'path');
  if (kind === 'play') {
    path.setAttribute('d', 'M4.5 2.75 13 8l-8.5 5.25z');
    path.setAttribute('fill', 'currentColor');
  } else if (kind === 'step') {
    path.setAttribute('d', 'M3.25 2.75 10.5 8l-7.25 5.25zM11.5 2.75H13v10.5h-1.5z');
    path.setAttribute('fill', 'currentColor');
  } else {
    const pathData =
      kind === 'reset'
        ? 'M13 5V2.5l-1.65 1.65A5.25 5.25 0 1 0 13.2 10'
        : kind === 'edit'
          ? 'M3 13h3l7-7-3-3-7 7zM9.5 3.5l3 3'
          : kind === 'filter'
            ? 'M2.5 3.25h11L9.25 8.1v3.9l-2.5 1V8.1z'
            : kind === 'close'
              ? 'M3.5 3.5l9 9M12.5 3.5l-9 9'
              : kind === 'sheet-expand'
                ? handsetSheetIconPaths('expand').join('')
                : kind === 'sheet-contract'
                  ? handsetSheetIconPaths('contract').join('')
                  : 'm4.5 6 3.5 3.5L11.5 6';
    path.setAttribute('d', pathData);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', 'currentColor');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');
    path.setAttribute('stroke-width', '1.5');
  }
  icon.append(path);
  return icon;
}
