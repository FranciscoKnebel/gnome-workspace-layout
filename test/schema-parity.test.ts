import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import { describe, expect, it } from 'vitest';
import { validateLayout, validateLayoutName } from '../src/shared/layout.js';
import type { LayoutFile } from '../src/shared/layout.js';
import { selectCapturedWindows } from '../src/shared/layout-transform.js';

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
  {
    name: 'name with a path separator',
    valid: false,
    layout: {
      name: '../escape',
      workspaces: {
        Dev: {
          windows: [
            { command: 'gnome-terminal', monitor: 0, position: 'left' },
          ],
        },
      },
    },
  },
  {
    name: 'name with surrounding whitespace',
    valid: false,
    layout: {
      name: ' trabalho',
      workspaces: {
        Dev: {
          windows: [
            { command: 'gnome-terminal', monitor: 0, position: 'left' },
          ],
        },
      },
    },
  },
];

describe('layout schema parity', () => {
  it('accepts wizard selections in the existing format, including sticky-only layouts', () => {
    const capture: LayoutFile = {
      name: 'selected',
      workspaces: {
        Code: {
          windows: [
            {
              appId: 'terminal.desktop',
              monitor: 0,
              position: 'left',
              minimized: true,
            },
          ],
        },
      },
      sticky: [{ appId: 'chat.desktop', monitor: 1, position: 'right' }],
    };

    for (const indices of [[0], [1], [0, 1]]) {
      const selected = selectCapturedWindows(capture, indices);
      expect(validateSchema(selected)).toBe(true);
      expect(validateLayout(selected).errors).toEqual([]);
    }
  });

  it.each(cases)('$name', ({ layout, valid }) => {
    const schemaResult = validateSchema(layout);
    const runtimeResult = validateLayout(layout).errors.length === 0;

    expect(schemaResult).toBe(valid);
    expect(runtimeResult).toBe(valid);
  });

  it('keeps layout name rules identical between schema and runtime', () => {
    const names = [
      'trabalho',
      'meu layout',
      'dev.dias',
      'a_b-c',
      'ação',
      'a'.repeat(64),
      'a'.repeat(65),
      ' trabalho',
      'trabalho ',
      ' ',
      '.',
      '..',
      '../escape',
      'a/b',
      'b/a',
      '/a',
      'a/',
      '/',
      'a\\b',
      '\\a',
      'a\\',
      '\\',
      'a\u0001',
      '\u0001a',
      'a\u0000b',
      'a\u007fb',
    ];

    for (const name of names) {
      const layout = {
        name,
        workspaces: {
          Dev: {
            windows: [
              { command: 'gnome-terminal', monitor: 0, position: 'left' },
            ],
          },
        },
      };

      expect(
        validateSchema(layout),
        `schema should agree on ${JSON.stringify(name)}`,
      ).toBe(validateLayoutName(name).length === 0);
    }
  });
});
