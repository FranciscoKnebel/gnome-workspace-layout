import { ExtensionPreferences } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';
import { WorkspaceLayoutApp } from './app.js';

export default class WorkspaceLayoutPreferences extends ExtensionPreferences {
  private app: WorkspaceLayoutApp | null = null;

  override fillPreferencesWindow(window: any): void {
    window.set_title('Workspace Layout');
    window.set_default_size(940, 760);
    window.set_search_enabled(false);
    this.app = new WorkspaceLayoutApp(window);
    this.app.attach();
  }
}
