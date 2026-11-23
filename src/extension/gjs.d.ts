declare module 'gi://Gio' {
  const Gio: any;
  export default Gio;
}

declare module 'gi://GLib' {
  const GLib: any;
  export default GLib;
}

declare module 'gi://Gtk' {
  const Gtk: any;
  export default Gtk;
}

declare module 'gi://Adw' {
  const Adw: any;
  export default Adw;
}

declare module 'cairo' {
  const cairo: any;
  export default cairo;
}

declare module 'gi://Shell' {
  const Shell: any;
  export default Shell;
}

declare module 'gi://Meta' {
  const Meta: any;
  export default Meta;
}

declare module 'resource:///org/gnome/shell/extensions/extension.js' {
  export class Extension {
    metadata: Record<string, unknown>;
    constructor(metadata: Record<string, unknown>);
    enable(): void;
    disable(): void;
  }
}

declare module 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js' {
  export class ExtensionPreferences {
    constructor(...args: any[]);
    fillPreferencesWindow(window: any): void;
  }
}

declare const global: any;
