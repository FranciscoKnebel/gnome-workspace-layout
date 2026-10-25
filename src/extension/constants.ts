export const BUS_NAME = 'com.franciscoknebel.WorkspaceLayout';
export const OBJECT_PATH = '/com/franciscoknebel/WorkspaceLayout';
export const DEFAULT_TIMEOUT_MS = 10000;

export const DBUS_XML = `
<node>
  <interface name="com.franciscoknebel.WorkspaceLayout">
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
      <arg type="s" name="result" direction="out" />
    </method>
    <method name="SaveSetup">
      <arg type="s" name="layoutJson" direction="in" />
      <arg type="b" name="force" direction="in" />
      <arg type="s" name="result" direction="out" />
    </method>
    <method name="Doctor">
      <arg type="s" name="result" direction="out" />
    </method>
  </interface>
</node>`;
