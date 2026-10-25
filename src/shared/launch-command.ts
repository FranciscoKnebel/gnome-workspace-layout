export type LaunchMetadata = {
  appId?: string;
  desktopFile?: string;
  desktopFileAvailable?: boolean;
  execLine?: string;
};

export function buildLaunchCommand(
  metadata: LaunchMetadata,
): string | undefined {
  const newWindowExec = readDesktopActionExec(
    metadata.desktopFile,
    'new-window',
  );
  if (newWindowExec !== undefined) {
    return newWindowExec;
  }

  const flatpakExec =
    metadata.execLine ?? readDesktopEntryExec(metadata.desktopFile);
  if (flatpakExec !== undefined && isFlatpakRun(flatpakExec)) {
    const command = sanitizeFlatpakExec(flatpakExec);
    if (command !== undefined) return command;
  }

  if (metadata.appId !== undefined && metadata.desktopFileAvailable !== false) {
    return `gtk-launch ${shellQuote(metadata.appId.replace(/\.desktop$/, ''))}`;
  }

  return undefined;
}

function readDesktopEntryExec(
  desktopFile: string | undefined,
): string | undefined {
  let section = '';
  for (const rawLine of desktopFile?.split(/\r?\n/) ?? []) {
    const line = rawLine.trim();
    const group = /^\[([^\]]+)]$/.exec(line);
    if (group !== null) section = group[1];
    else if (section === 'Desktop Entry' && line.startsWith('Exec='))
      return line.slice(5);
  }
  return undefined;
}

function isFlatpakRun(exec: string): boolean {
  return /^(?:\/usr\/bin\/)?flatpak\s+run(?:\s|$)/.test(exec);
}

function sanitizeFlatpakExec(exec: string): string | undefined {
  // Do not remove marker-like text inside quoted browser/profile arguments.
  const tokens: string[] = [];
  let token = '';
  let quote: string | null = null;
  for (const character of exec) {
    if (character === "'" || character === '"') {
      if (quote === null) quote = character;
      else if (quote === character) quote = null;
    }
    if (quote === null && /\s/.test(character)) {
      if (token !== '') tokens.push(token);
      token = '';
    } else token += character;
  }
  if (quote !== null) return undefined;
  if (token !== '') tokens.push(token);
  const withoutForwarding = tokens
    .filter((value) => !['@@', '@@u', '--file-forwarding'].includes(value))
    .join(' ');
  return sanitizeDesktopExec(withoutForwarding);
}

function readDesktopActionExec(
  desktopFile: string | undefined,
  action: string,
): string | undefined {
  if (desktopFile === undefined) {
    return undefined;
  }

  const lines = desktopFile.split(/\r?\n/);
  let section = '';
  let announced = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    const sectionMatch = /^\[([^\]]+)]$/.exec(line);
    if (sectionMatch !== null) {
      section = sectionMatch[1];
      continue;
    }

    if (section === 'Desktop Entry' && line.startsWith('Actions=')) {
      announced = line.slice('Actions='.length).split(';').includes(action);
    }
  }

  if (!announced) {
    return undefined;
  }

  section = '';
  for (const rawLine of lines) {
    const line = rawLine.trim();
    const sectionMatch = /^\[([^\]]+)]$/.exec(line);
    if (sectionMatch !== null) {
      section = sectionMatch[1];
      continue;
    }

    if (section === `Desktop Action ${action}` && line.startsWith('Exec=')) {
      const exec = line.slice('Exec='.length);
      return isFlatpakRun(exec)
        ? sanitizeFlatpakExec(exec)
        : sanitizeDesktopExec(exec);
    }
  }

  return undefined;
}

function sanitizeDesktopExec(exec: string): string | undefined {
  if (exec.includes('\\')) {
    return undefined;
  }

  const fieldCodes = new Set([
    'd',
    'D',
    'f',
    'F',
    'm',
    'n',
    'N',
    'u',
    'U',
    'v',
  ]);
  let command = '';

  for (let index = 0; index < exec.length; index += 1) {
    const character = exec[index];
    if (character !== '%') {
      command += character;
      continue;
    }

    const code = exec[index + 1];
    if (code === '%') {
      command += '%';
      index += 1;
      continue;
    }

    if (code === undefined || !fieldCodes.has(code)) {
      return undefined;
    }

    const previous = exec[index - 1];
    const following = exec[index + 2];
    if (
      (previous !== undefined && !/\s/.test(previous)) ||
      (following !== undefined && !/\s/.test(following))
    ) {
      return undefined;
    }

    index += 1;
  }

  const normalized = normalizeUnquotedWhitespace(command);
  return normalized === '' ? undefined : normalized;
}

function normalizeUnquotedWhitespace(command: string): string | undefined {
  let normalized = '';
  let quote: "'" | '"' | null = null;
  let escaped = false;
  let pendingSpace = false;

  for (const character of command.trim()) {
    if (escaped) {
      normalized += character;
      escaped = false;
      continue;
    }

    if (character === '\\') {
      if (pendingSpace) {
        normalized += ' ';
        pendingSpace = false;
      }
      normalized += character;
      escaped = true;
      continue;
    }

    if (character === "'" || character === '"') {
      if (quote === null) {
        quote = character;
      } else if (quote === character) {
        quote = null;
      }
    }

    if (quote === null && /\s/.test(character)) {
      pendingSpace = normalized !== '';
      continue;
    }

    if (pendingSpace) {
      normalized += ' ';
      pendingSpace = false;
    }
    normalized += character;
  }

  return quote === null ? normalized : undefined;
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}
