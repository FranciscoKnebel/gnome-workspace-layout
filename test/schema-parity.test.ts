import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import { describe, expect, it } from 'vitest';
import { validateLayout, type LayoutWindow } from '../src/shared/layout.js';
import { buildLaunchCommand } from '../src/shared/launch-command.js';

const schema = JSON.parse(
  readFileSync(resolve('schema/workspace-layout.schema.json'), 'utf8'),
) as object;

const ajv = new Ajv2020({ allErrors: true });
const validateSchema = ajv.compile(schema);

const cases: Array<{ name: string; layout: unknown; valid: boolean }> = [
  {
    name: 'minimal command layout',
    valid: true,
    layout: {
      name: 'trabalho',
      workspaces: {
        Dev: {
          windows: [
            {
              command: 'gnome-terminal',
              monitor: 0,
              position: 'left',
            },
          ],
        },
      },
    },
  },
  {
    name: 'minimal app id layout',
    valid: true,
    layout: {
      name: 'trabalho',
      workspaces: {
        Dev: {
          windows: [
            {
              appId: 'org.gnome.Terminal.desktop',
              monitor: 0,
              position: 'full',
            },
          ],
        },
      },
    },
  },
  {
    name: 'custom relative rectangle',
    valid: true,
    layout: {
      name: 'trabalho',
      workspaces: {
        Dev: {
          windows: [
            {
              command: 'firefox',
              monitor: 1,
              position: { x: 0, y: 0.1, width: 0.5, height: 0.8 },
            },
          ],
        },
      },
    },
  },
  {
    name: 'sticky windows only',
    valid: true,
    layout: {
      name: 'global-tools',
      sticky: [
        {
          command: 'gnome-terminal',
          monitor: 0,
          position: 'right',
        },
      ],
      workspaces: {},
    },
  },
  {
    name: 'empty layout',
    valid: false,
    layout: {
      name: 'empty',
      workspaces: {},
    },
  },
  {
    name: 'invalid sticky window',
    valid: false,
    layout: {
      name: 'broken',
      sticky: [{ monitor: 0, position: 'left' }],
      workspaces: {},
    },
  },
  {
    name: 'empty command match',
    valid: false,
    layout: {
      name: 'broken',
      workspaces: {
        Dev: {
          windows: [
            {
              command: 'custom-command',
              match: {},
              monitor: 0,
              position: 'left',
            },
          ],
        },
      },
    },
  },
  {
    name: 'empty command',
    valid: false,
    layout: {
      name: 'broken',
      workspaces: {
        Dev: { windows: [{ command: '', monitor: 0, position: 'left' }] },
      },
    },
  },
  {
    name: 'zero width relative rectangle',
    valid: false,
    layout: {
      name: 'broken',
      workspaces: {
        Dev: {
          windows: [
            {
              command: 'firefox',
              monitor: 0,
              position: { x: 0, y: 0, width: 0, height: 1 },
            },
          ],
        },
      },
    },
  },
];

describe('layout schema parity', () => {
  it.each(cases)('$name', ({ layout, valid }) => {
    const schemaResult = validateSchema(layout);
    const runtimeResult = validateLayout(layout).errors.length === 0;

    expect(schemaResult).toBe(valid);
    expect(runtimeResult).toBe(valid);
  });
});

describe('captured launch contract schema parity', () => {
  const launchCases = [
    {
      name: 'desktop new-window action',
      metadata: {
        appId: 'org.gnome.Ptyxis.desktop',
        desktopFile:
          '[Desktop Entry]\nActions=new-window;\n[Desktop Action new-window]\nExec=ptyxis --new-window',
      },
      command: 'ptyxis --new-window',
    },
    {
      name: 'Flatpak browser profile and PWA without an action',
      metadata: {
        appId: 'com.google.Chrome.desktop',
        desktopFile:
          '[Desktop Entry]\nExec=flatpak run --file-forwarding com.google.Chrome --profile-directory="Profile 1" --app-id=abc @@u %U @@',
      },
      command:
        'flatpak run com.google.Chrome --profile-directory="Profile 1" --app-id=abc',
    },
    {
      name: 'native desktop fallback',
      metadata: {
        appId: 'org.example.App.desktop',
        desktopFile: '[Desktop Entry]\nExec=example %U',
      },
      command: "gtk-launch 'org.example.App'",
    },
    {
      name: 'unsupported Flatpak syntax falls back',
      metadata: {
        appId: 'org.example.App.desktop',
        execLine: 'flatpak run org.example.App --name=%c',
      },
      command: "gtk-launch 'org.example.App'",
    },
    {
      name: 'Electron without a readable desktop entry',
      metadata: {
        appId: 'electron.desktop',
        desktopFileAvailable: false,
      },
      command: undefined,
    },
  ];

  for (const group of ['workspace', 'sticky'] as const) {
    const layoutFor = (window: unknown) => ({
      name: 'capture-contract',
      workspaces: group === 'workspace' ? { Dev: { windows: [window] } } : {},
      ...(group === 'sticky' ? { sticky: [window] } : {}),
    });

    it.each(launchCases)(
      `${group}: $name survives JSON persistence`,
      (entry) => {
        const command = buildLaunchCommand(entry.metadata);
        expect(command).toBe(entry.command);
        const window: LayoutWindow = {
          appId: entry.metadata.appId,
          ...(command !== undefined ? { command } : {}),
          match: { wmClass: 'captured-window' },
          monitor: 0,
          position: 'left',
        };
        expect(Object.hasOwn(window, 'command')).toBe(command !== undefined);
        const layout: unknown = JSON.parse(JSON.stringify(layoutFor(window)));
        expect(validateSchema(layout)).toBe(true);
        expect(validateLayout(layout).errors).toEqual([]);
      },
    );

    it(`${group}: accepts a custom command without appId`, () => {
      const layout = layoutFor({
        command: 'custom-launcher --new-window',
        monitor: 0,
        position: 'left',
      });
      expect(validateSchema(layout)).toBe(true);
      expect(validateLayout(layout).errors).toEqual([]);
    });

    it.each(['', 123, null, []])(
      `${group}: rejects invalid command %j even with appId`,
      (command) => {
        const layout = layoutFor({
          appId: 'org.example.App.desktop',
          command,
          monitor: 0,
          position: 'left',
        });
        expect(validateSchema(layout)).toBe(false);
        expect(validateLayout(layout).errors.length).toBeGreaterThan(0);
      },
    );

    it(`${group}: rejects wmClass without a launch identity`, () => {
      const layout = layoutFor({
        match: { wmClass: 'electron' },
        monitor: 0,
        position: 'left',
      });
      expect(validateSchema(layout)).toBe(false);
      expect(validateLayout(layout).errors.length).toBeGreaterThan(0);
    });
  }
});
