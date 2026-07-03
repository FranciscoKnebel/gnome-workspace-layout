declare module 'gi://Gio' {
  const Gio: any;
  export default Gio;
}

declare module 'gi://GLib' {
  const GLib: any;
  export default GLib;
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

declare const global: any;
