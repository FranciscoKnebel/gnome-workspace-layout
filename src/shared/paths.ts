export type WorkspaceLayoutPaths = {
  layoutsDir: string;
  schemaDir: string;
  schemaPath: string;
};

export function workspaceLayoutPaths(
  configDir: string,
  dataDir: string,
): WorkspaceLayoutPaths {
  const layoutsDir = joinPath(configDir, 'workspace-layout', 'layouts');
  const schemaDir = joinPath(dataDir, 'workspace-layout', 'schema');

  return {
    layoutsDir,
    schemaDir,
    schemaPath: joinPath(schemaDir, 'workspace-layout.schema.json'),
  };
}

export function joinPath(...parts: string[]): string {
  let root = '';

  const segments = parts
    .map((part, index) => {
      if (index === 0) {
        root = /^\/+/.test(part) ? '/' : '';
        return part.replace(/^\/+|\/+$/g, '');
      }
      return part.replace(/^\/+|\/+$/g, '');
    })
    .filter((part) => part !== '');

  return `${root}${segments.join('/')}`;
}
