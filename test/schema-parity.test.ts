import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import { describe, expect, it } from 'vitest';
import { validateLayout } from '../src/shared/layout.js';

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

describe('optional window field parity', () => {
  for (const group of ['workspace', 'sticky']) {
    for (const [field, value, valid] of [
      ['minimized', 'yes', false],
      ['title', 123, false],
      ['label', [], false],
      ['minimized', false, true],
      ['title', '', true],
      ['label', '', true],
    ] as const) {
      it(`${group}: ${field} = ${JSON.stringify(value)}`, () => {
        const window = {
          command: 'ptyxis --new-window',
          monitor: 0,
          position: 'left',
          [field]: value,
        };
        const layout =
          group === 'sticky'
            ? { name: 'test', workspaces: {}, sticky: [window] }
            : { name: 'test', workspaces: { Dev: { windows: [window] } } };
        expect(validateSchema(layout)).toBe(valid);
        expect(validateLayout(layout).errors.length === 0).toBe(valid);
      });
    }
  }
});
