import Adw from 'gi://Adw';
import GLib from 'gi://GLib';
import { windowDisplayName } from '../shared/display.js';
import type { LayoutWindow, WindowPosition } from '../shared/layout.js';
import type { OperationResult } from '../shared/result.js';

export function showResult(
  parent: any,
  heading: string,
  operationResult: OperationResult,
): void {
  const lines = [
    ...operationResult.messages,
    ...operationResult.errors.map((error) => `Error: ${error}`),
  ];
  const dialog = new Adw.AlertDialog({
    heading,
    body:
      lines.length > 0
        ? lines.join('\n')
        : 'The operation returned no additional details.',
  });
  dialog.add_response('close', 'Close');
  dialog.set_default_response('close');
  dialog.set_close_response('close');
  dialog.present(parent);
}

export function showError(parent: any, heading: string, message: string): void {
  const dialog = new Adw.AlertDialog({ heading, body: message });
  dialog.add_response('close', 'Close');
  dialog.set_default_response('close');
  dialog.set_close_response('close');
  dialog.present(parent);
}

export function confirmDestructive(
  parent: any,
  heading: string,
  body: string,
  actionLabel: string,
  onConfirm: () => void,
): void {
  const dialog = new Adw.AlertDialog({ heading, body });
  dialog.add_response('cancel', 'Cancel');
  dialog.add_response('confirm', actionLabel);
  dialog.set_response_appearance('confirm', Adw.ResponseAppearance.DESTRUCTIVE);
  dialog.set_default_response('cancel');
  dialog.set_close_response('cancel');
  dialog.connect('response', (_dialog: any, response: string) => {
    if (response === 'confirm') {
      onConfirm();
    }
  });
  dialog.present(parent);
}

/**
 * Removes control characters and escapes Pango markup for Adw row titles and
 * subtitles, which interpret their text as markup.
 */
export function singleLine(value: string): string {
  return GLib.markup_escape_text(
    value.replace(/[\p{Cc}\p{Cf}]+/gu, ' ').trim(),
    -1,
  );
}

export class RowGroup {
  private readonly rows: any[] = [];

  constructor(private readonly group: any) {}

  add(row: any): void {
    this.rows.push(row);
    this.group.add(row);
  }

  clear(): void {
    for (const row of this.rows) {
      this.group.remove(row);
    }

    this.rows.length = 0;
  }
}

export function plural(count: number, singular: string): string {
  return `${count} ${singular}${count === 1 ? '' : 's'}`;
}

export function formatWindowTitle(windowEntry: LayoutWindow): string {
  return singleLine(windowDisplayName(windowEntry));
}

export function formatWindowDetails(windowEntry: LayoutWindow): string {
  const details = [
    `Monitor ${windowEntry.monitor}`,
    formatPosition(windowEntry.position),
  ];

  if (windowEntry.minimized === true) {
    details.push('minimized');
  }

  return details.join(' | ');
}

export function formatPosition(position: WindowPosition): string {
  if (typeof position === 'string') {
    return position;
  }

  return `${percent(position.x)} at ${percent(position.y)}, ${percent(position.width)} x ${percent(position.height)}`;
}

export function formatTimestamp(seconds: number | null): string {
  if (seconds === null) {
    return 'Unknown';
  }

  return new Date(seconds * 1000).toLocaleString();
}

function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}
