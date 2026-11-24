export type WorkspaceStatus = {
  index: number;
  name: string;
  active: boolean;
};

export type MonitorStatus = {
  index: number;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type RuntimeStatus = {
  monitors: MonitorStatus[];
  workspaces: WorkspaceStatus[];
  activeWorkspaceIndex: number;
  layoutsDir: string;
  schemaPath: string;
};
