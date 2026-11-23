import { describe, expect, it } from 'vitest';
import {
  BUS_NAME,
  describeDbusFailure,
  INTERFACE_NAME,
  OBJECT_PATH,
} from '../src/shared/dbus.js';

describe('D-Bus identity', () => {
  it('uses one canonical bus name, object path and interface', () => {
    expect(BUS_NAME).toBe('com.franciscoknebel.WorkspaceLayout');
    expect(OBJECT_PATH).toBe('/com/franciscoknebel/WorkspaceLayout');
    expect(INTERFACE_NAME).toBe(BUS_NAME);
  });
});

describe('describeDbusFailure', () => {
  it('explains a missing extension', () => {
    expect(
      describeDbusFailure(
        'Apply',
        'org.freedesktop.DBus.Error.ServiceUnknown: The name is not activatable',
      ),
    ).toContain('is not running');
  });

  it('keeps method-specific wizard guidance', () => {
    expect(
      describeDbusFailure(
        'PreviewSetup',
        'org.freedesktop.DBus.Error.UnknownMethod: No such method',
      ),
    ).toContain('does not support --configure');
    expect(
      describeDbusFailure(
        'SetupForce',
        'org.freedesktop.DBus.Error.UnknownMethod: No such method',
      ),
    ).toContain('does not support --force');
  });

  it('reports gate and timeout conditions', () => {
    expect(
      describeDbusFailure(
        'Apply',
        'Another workspace-layout operation is already running',
      ),
    ).toContain('already running');
    expect(describeDbusFailure('Apply', 'Timeout was reached')).toContain(
      'did not answer in time',
    );
  });
});
