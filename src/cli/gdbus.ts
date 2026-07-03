export function parseGdbusSingleString(output: string): string {
  const trimmed = output.trim();
  const match = /^\('([\s\S]*)',\)$/.exec(trimmed);
  if (match === null || match[1] === undefined) {
    throw new Error(`Unexpected gdbus output: ${trimmed}`);
  }

  return unescapeGVariantString(match[1]);
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
      case 'n':
        result += '\n';
        break;
      case 'r':
        result += '\r';
        break;
      case 't':
        result += '\t';
        break;
      default:
        result += next;
        break;
    }
  }

  return result;
}
