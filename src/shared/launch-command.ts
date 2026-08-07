export type LaunchMetadata = {
  appId?: string;
  desktopFile?: string;
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

  if (metadata.appId !== undefined) {
    return `gtk-launch ${shellQuote(metadata.appId.replace(/\.desktop$/, ''))}`;
  }

  return undefined;
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
      return sanitizeDesktopExec(line.slice('Exec='.length));
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
