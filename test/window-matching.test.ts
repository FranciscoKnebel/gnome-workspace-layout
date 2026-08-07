import { describe, expect, it } from 'vitest';
import type { LayoutWindow } from '../src/shared/layout.js';
import { matchesWindowIdentity } from '../src/shared/window-matching.js';

const windowEntry: LayoutWindow = {
  appId: 'org.gnome.Ptyxis.desktop',
  command: 'ptyxis --new-window',
  match: {
    appId: 'org.gnome.Ptyxis.desktop',
    wmClass: 'org.gnome.Ptyxis',
    title: 'Terminal',
  },
  monitor: 0,
  position: 'left',
};

describe('window identity matching', () => {
  it('matches every explicit identity field', () => {
    expect(
      matchesWindowIdentity(
        {
          appId: 'org.gnome.Ptyxis.desktop',
          wmClass: 'org.gnome.Ptyxis',
          title: 'Terminal - project',
        },
        windowEntry,
      ),
    ).toBe(true);
  });

  it('does not match until required metadata is available', () => {
    expect(matchesWindowIdentity({}, windowEntry)).toBe(false);
    expect(
      matchesWindowIdentity(
        {
          appId: 'org.gnome.Ptyxis.desktop',
          wmClass: 'org.gnome.Ptyxis',
          title: 'Terminal - project',
        },
        windowEntry,
      ),
    ).toBe(true);
  });

  it('uses appId when no explicit match is configured', () => {
    expect(
      matchesWindowIdentity(
        { appId: 'org.gnome.Ptyxis.desktop' },
        { ...windowEntry, match: undefined },
      ),
    ).toBe(true);
    expect(
      matchesWindowIdentity(
        { appId: 'org.gnome.Nautilus.desktop' },
        { ...windowEntry, match: undefined },
      ),
    ).toBe(false);
  });

  it('matches a command-only entry by its spawned process id', () => {
    const commandOnly = {
      command: 'custom-command',
      monitor: 0,
      position: 'left' as const,
    };

    expect(matchesWindowIdentity({ pid: 123 }, commandOnly, 123)).toBe(true);
    expect(matchesWindowIdentity({ pid: 456 }, commandOnly, 123)).toBe(false);
    expect(matchesWindowIdentity({ pid: 123 }, commandOnly)).toBe(false);
  });
});
