import { BUS_NAME, INTERFACE_NAME, OBJECT_PATH } from '../shared/dbus.js';

export { BUS_NAME, INTERFACE_NAME, OBJECT_PATH };

export const DEFAULT_TIMEOUT_MS = 10000;

export const DBUS_XML = `
<node>
  <interface name="${INTERFACE_NAME}">
    <method name="Apply">
      <arg type="s" name="name" direction="in" />
      <arg type="s" name="result" direction="out" />
    </method>
    <method name="Setup">
      <arg type="s" name="name" direction="in" />
      <arg type="b" name="includeMinimized" direction="in" />
      <arg type="s" name="result" direction="out" />
    </method>
    <method name="SetupForce">
      <arg type="s" name="name" direction="in" />
      <arg type="b" name="includeMinimized" direction="in" />
      <arg type="s" name="result" direction="out" />
    </method>
    <method name="PreviewSetup">
      <arg type="s" name="name" direction="in" />
      <arg type="b" name="includeMinimized" direction="in" />
      <arg type="b" name="force" direction="in" />
      <arg type="s" name="result" direction="out" />
    </method>
    <method name="SaveSetup">
      <arg type="s" name="layout" direction="in" />
      <arg type="b" name="force" direction="in" />
      <arg type="s" name="result" direction="out" />
    </method>
    <method name="Doctor">
      <arg type="s" name="result" direction="out" />
    </method>
    <method name="ReadLayout">
      <arg type="s" name="name" direction="in" />
      <arg type="s" name="result" direction="out" />
    </method>
    <method name="DeleteLayout">
      <arg type="s" name="name" direction="in" />
      <arg type="s" name="result" direction="out" />
    </method>
    <method name="GetOverview">
      <arg type="s" name="result" direction="out" />
    </method>
  </interface>
</node>`;
