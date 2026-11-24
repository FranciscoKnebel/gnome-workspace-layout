import type { LayoutFile } from './layout.js';

export function copyLayout(layout: LayoutFile): LayoutFile {
  return JSON.parse(JSON.stringify(layout)) as LayoutFile;
}
