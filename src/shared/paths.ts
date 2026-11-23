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
  return parts
    .map((part, index) =>
      index === 0 ? part.replace(/\/+$/, '') : part.replace(/^\/+|\/+$/g, ''),
    )
    .filter((part) => part !== '')
    .join('/');
}
