import { describe, expect, it } from 'vitest';
import { buildLaunchCommand } from '../src/shared/launch-command.js';

describe('captured launch command', () => {
  it('prefers a native new-window desktop action', () => {
    expect(
      buildLaunchCommand({
        appId: 'org.gnome.Ptyxis.desktop',
        desktopFile: `[Desktop Entry]
Exec=ptyxis
Actions=new-window;

[Desktop Action new-window]
Exec=ptyxis --new-window
`,
      }),
    ).toBe('ptyxis --new-window');
  });

  it('preserves a Flatpak new-window action', () => {
    expect(
      buildLaunchCommand({
        appId: 'com.google.Chrome.desktop',
        desktopFile: `[Desktop Entry]
Exec=/usr/bin/flatpak run --file-forwarding com.google.Chrome @@u %U @@
Actions=new-window;

[Desktop Action new-window]
Exec=/usr/bin/flatpak run --command=/app/bin/chrome com.google.Chrome
`,
      }),
    ).toBe('/usr/bin/flatpak run --command=/app/bin/chrome com.google.Chrome');
  });

  it('removes desktop field codes from an Electron new-window action', () => {
    expect(
      buildLaunchCommand({
        appId: 'antigravity-ide.desktop',
        desktopFile: `[Desktop Entry]
Exec=/usr/local/bin/antigravity-ide %F
Actions=new-window;

[Desktop Action new-window]
Exec=/usr/local/bin/antigravity-ide --new-window %F %%
`,
      }),
    ).toBe('/usr/local/bin/antigravity-ide --new-window %');
  });

  it('falls back to gtk-launch when no new-window action exists', () => {
    expect(
      buildLaunchCommand({
        appId: 'ai.opencode.desktop.desktop',
        desktopFile: `[Desktop Entry]
Exec=/opt/OpenCode/ai.opencode.desktop %U
`,
      }),
    ).toBe("gtk-launch 'ai.opencode.desktop'");
  });

  it('quotes unusual desktop IDs', () => {
    expect(buildLaunchCommand({ appId: "author's app.desktop" })).toBe(
      "gtk-launch 'author'\\''s app'",
    );
  });

  it('does not treat a window class as an executable', () => {
    expect(buildLaunchCommand({})).toBeUndefined();
  });

  it('ignores an action not announced by the desktop entry', () => {
    expect(
      buildLaunchCommand({
        appId: 'org.example.App.desktop',
        desktopFile: `[Desktop Entry]
Exec=example

[Desktop Action new-window]
Exec=example --new-window
`,
      }),
    ).toBe("gtk-launch 'org.example.App'");
  });

  it('falls back when desktop escaping requires interpretation', () => {
    expect(
      buildLaunchCommand({
        appId: 'org.example.App.desktop',
        desktopFile: `[Desktop Entry]
Actions=new-window;

[Desktop Action new-window]
Exec=example --name=two\\swords
`,
      }),
    ).toBe("gtk-launch 'org.example.App'");
  });

  it('falls back for attached field codes or unclosed quotes', () => {
    const desktopFile = (exec: string) => `[Desktop Entry]
Actions=new-window;

[Desktop Action new-window]
Exec=${exec}
`;

    expect(
      buildLaunchCommand({
        appId: 'org.example.App.desktop',
        desktopFile: desktopFile('example --file=%F'),
      }),
    ).toBe("gtk-launch 'org.example.App'");
    expect(
      buildLaunchCommand({
        appId: 'org.example.App.desktop',
        desktopFile: desktopFile("example 'unclosed"),
      }),
    ).toBe("gtk-launch 'org.example.App'");
  });

  it('falls back for field codes that require expansion', () => {
    expect(
      buildLaunchCommand({
        appId: 'org.example.App.desktop',
        desktopFile: `[Desktop Entry]
Actions=new-window;

[Desktop Action new-window]
Exec=example --name %c
`,
      }),
    ).toBe("gtk-launch 'org.example.App'");
  });
});
