import type { LayoutWindow } from './layout.js';

export type WindowIdentity = {
  appId?: string;
  pid?: number;
  title?: string;
  wmClass?: string;
};

export function matchesWindowIdentity(
  identity: WindowIdentity,
  windowEntry: LayoutWindow,
  launchPid?: number,
): boolean {
  const match = windowEntry.match;

  if (match?.appId !== undefined && identity.appId !== match.appId) {
    return false;
  }

  if (match?.wmClass !== undefined && identity.wmClass !== match.wmClass) {
    return false;
  }

  if (
    match?.title !== undefined &&
    !String(identity.title ?? '').includes(match.title)
  ) {
    return false;
  }

  if (
    match === undefined &&
    windowEntry.appId !== undefined &&
    identity.appId !== windowEntry.appId
  ) {
    return false;
  }

  if (match === undefined && windowEntry.appId === undefined) {
    return launchPid !== undefined && identity.pid === launchPid;
  }

  return true;
}
