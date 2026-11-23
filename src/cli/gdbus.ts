import { describeDbusFailure } from '../shared/dbus.js';

export function describeCliDbusFailure(method: string, stderr: string): string {
  if (
    (method === 'PreviewSetup' || method === 'SaveSetup') &&
    stderr.includes('UnknownMethod')
  ) {
    return 'The running extension does not support --configure. Reinstall the extension and log out/in, then try again.';
  }

  if (method === 'SetupForce' && stderr.includes('UnknownMethod')) {
    return 'The running extension does not support --force. Restart GNOME Shell or log out/in, then try again.';
  }

  return describeDbusFailure(stderr);
}

export function parseGdbusSingleString(output: string): string {
  const trimmed = output.trim();
  const match =
    /^\((?:'((?:\\[\s\S]|[^'\\])*)'|"((?:\\[\s\S]|[^"\\])*)"),\)$/.exec(
      trimmed,
    );
  const value = match?.[1] ?? match?.[2];
  if (value === undefined) {
    throw new Error(`Unexpected gdbus output: ${trimmed}`);
  }

  return unescapeGVariantString(value);
}

function unescapeGVariantString(value: string): string {
  let result = '';

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if (char !== '\\') {
      result += char;
      continue;
    }

    const next = value[index + 1];
    if (next === undefined) {
      result += char;
      continue;
    }

    index += 1;
    switch (next) {
      case 'a':
        result += '\x07';
        break;
      case 'b':
        result += '\b';
        break;
      case 'f':
        result += '\f';
        break;
      case 'n':
        result += '\n';
        break;
      case 'r':
        result += '\r';
        break;
      case 't':
        result += '\t';
        break;
      case 'v':
        result += '\v';
        break;
      case '\n':
        break;
      case 'u':
      case 'U': {
        const length = next === 'u' ? 4 : 8;
        const hex = value.slice(index + 1, index + 1 + length);
        const codePoint = Number.parseInt(hex, 16);
        if (
          hex.length !== length ||
          !/^[\da-f]+$/i.test(hex) ||
          codePoint === 0 ||
          codePoint > 0x10ffff ||
          (codePoint >= 0xd800 && codePoint <= 0xdfff)
        ) {
          throw new Error('Invalid Unicode escape in gdbus output');
        }
        result += String.fromCodePoint(codePoint);
        index += length;
        break;
      }
      default:
        result += next;
        break;
    }
  }

  return result;
}
