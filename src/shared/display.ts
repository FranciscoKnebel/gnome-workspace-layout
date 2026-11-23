import type { LayoutWindow } from './layout.js';

export function windowDisplayName(
  window: Pick<LayoutWindow, 'label' | 'title' | 'appId' | 'command'>,
): string {
  return (
    window.label ?? window.title ?? window.appId ?? window.command ?? 'Window'
  );
}
