import { beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  readLayout: vi.fn(),
  launchAndWaitForNewWindow: vi.fn(),
  placeWindow: vi.fn(),
  makeStickyWindow: vi.fn(),
}));
vi.mock('../src/extension/layout-store.js', () => ({
  readLayout: mocks.readLayout,
}));
vi.mock('../src/extension/shell.js', () => ({
  ...mocks,
  findWorkspaceByName: () => ({ index: () => 0 }),
  getActiveWorkspaceIndex: () => 0,
  getMonitorRect: () => ({ x: 0, y: 0, width: 1920, height: 1080 }),
}));
const { applyLayout } = await import('../src/extension/apply-service.js');

beforeEach(() => vi.clearAllMocks());

it('waits for each created window before launching the next and applying sticky state', async () => {
  const entry = {
    command: 'app',
    monitor: 0,
    position: 'left',
    minimized: true,
  };
  mocks.readLayout.mockReturnValue({
    name: 'test',
    workspaces: { Dev: { windows: [entry] } },
    sticky: [entry],
  });
  const created = {
    change_workspace: vi.fn(),
    minimize: vi.fn(),
    get_title: () => 'new',
  };
  let complete;
  mocks.launchAndWaitForNewWindow
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          complete = resolve;
        }),
    )
    .mockResolvedValueOnce(created);
  const pending = applyLayout('test');
  expect(mocks.launchAndWaitForNewWindow).toHaveBeenCalledOnce();
  expect(mocks.placeWindow).not.toHaveBeenCalled();
  complete(created);
  expect((await pending).ok).toBe(true);
  expect(mocks.launchAndWaitForNewWindow).toHaveBeenCalledTimes(2);
  expect(mocks.placeWindow).toHaveBeenCalledTimes(2);
  expect(created.change_workspace).toHaveBeenCalledOnce();
  expect(mocks.makeStickyWindow).toHaveBeenCalledWith(created);
  expect(created.minimize).toHaveBeenCalledTimes(2);
});

it('reports a timeout and continues to the next layout entry', async () => {
  const entry = { command: 'app', monitor: 0, position: 'left' };
  mocks.readLayout.mockReturnValue({
    name: 'test',
    workspaces: {},
    sticky: [entry, entry],
  });
  const created = { get_title: () => 'new' };
  mocks.launchAndWaitForNewWindow
    .mockResolvedValueOnce(null)
    .mockResolvedValueOnce(created);
  const result = await applyLayout('test');
  expect(result.ok).toBe(false);
  expect(result.errors).toEqual(['Timed out waiting for app']);
  expect(mocks.placeWindow).toHaveBeenCalledExactlyOnceWith(created, {
    x: 0,
    y: 0,
    width: 960,
    height: 1080,
  });
});
