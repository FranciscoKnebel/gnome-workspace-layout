import { beforeEach, expect, it, vi } from 'vitest';
import { configureSetup } from '../src/cli/configure.js';

const { question, close, write } = vi.hoisted(() => ({
  question: vi.fn(),
  close: vi.fn(),
  write: vi.fn(),
}));
vi.mock('node:process', () => ({
  stdin: { isTTY: true },
  stdout: { isTTY: true, write },
}));
vi.mock('node:readline/promises', () => ({
  createInterface: () => ({ question, close }),
}));

beforeEach(() => vi.resetAllMocks());

it.each(['constructor', 'toString', '__proto__'])(
  'confirms literal workspace %s through the wizard',
  async (name) => {
    const layout = JSON.parse(
      `{"name":"test","workspaces":{"${name}":{"windows":[{"appId":"app.desktop","monitor":0,"position":"left"}]}}}`,
    );
    question.mockResolvedValueOnce('all').mockResolvedValueOnce('y');
    const call = vi.fn((method: string) =>
      method === 'PreviewSetup'
        ? { ok: true, errors: [], messages: [], layout }
        : { ok: true, errors: [], messages: ['Wrote test'] },
    );
    const result = await configureSetup(
      { name: 'test', configure: true, force: true, includeMinimized: true },
      call,
    );
    expect(result.ok).toBe(true);
    expect(call).toHaveBeenNthCalledWith(1, 'PreviewSetup', ['test', true]);
    expect(call).toHaveBeenNthCalledWith(2, 'SaveSetup', [
      JSON.stringify(layout),
      true,
    ]);
    expect(close).toHaveBeenCalledOnce();
  },
);

it.each([
  ['', ''],
  ['all', 'n'],
])(
  'does not save on cancellation (%s, %s)',
  async (selection, confirmation) => {
    question
      .mockResolvedValueOnce(selection)
      .mockResolvedValueOnce(confirmation);
    const call = vi.fn(() => ({
      ok: true,
      errors: [],
      messages: [],
      layout: {
        name: 'test',
        workspaces: {},
        sticky: [{ command: 'app', monitor: 0, position: 'left' }],
      },
    }));
    await configureSetup(
      { name: 'test', configure: true, force: false, includeMinimized: false },
      call,
    );
    expect(call).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledOnce();
  },
);
