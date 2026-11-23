export const BUS_NAME = 'com.franciscoknebel.WorkspaceLayout';
export const OBJECT_PATH = '/com/franciscoknebel/WorkspaceLayout';
export const INTERFACE_NAME = 'com.franciscoknebel.WorkspaceLayout';

export function describeDbusFailure(method: string, message: string): string {
  if (
    (method === 'PreviewSetup' || method === 'SaveSetup') &&
    message.includes('UnknownMethod')
  ) {
    return 'The running extension does not support --configure. Reinstall the extension and log out/in, then try again.';
  }

  if (method === 'SetupForce' && message.includes('UnknownMethod')) {
    return 'The running extension does not support --force. Restart GNOME Shell or log out/in, then try again.';
  }

  if (message.includes('UnknownMethod') || message.includes('Unknown method')) {
    return 'The installed extension is older than this client. Reinstall it and restart GNOME Shell.';
  }

  if (
    [
      'org.freedesktop.DBus.Error.ServiceUnknown',
      'org.freedesktop.DBus.Error.NameHasNoOwner',
      'NameHasNoOwner',
      'ServiceUnknown',
      'not activatable',
      'Could not connect',
    ].some((candidate) => message.includes(candidate))
  ) {
    return 'Workspace Layout is not running. Enable the extension in GNOME Extensions and make sure the session is unlocked.';
  }

  if (
    message.includes('Another workspace-layout operation is already running')
  ) {
    return 'Another workspace-layout operation is already running. Wait for it to finish and try again.';
  }

  if (
    message.includes('org.freedesktop.DBus.Error.Timeout') ||
    message.includes('Timeout was reached')
  ) {
    return 'The extension did not answer in time. It may still be applying the layout.';
  }

  return message;
}
