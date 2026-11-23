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

declare module 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js' {
  export class ExtensionPreferences {
    constructor(...args: any[]);
    fillPreferencesWindow(window: any): void;
  }
}
