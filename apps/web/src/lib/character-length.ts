export function getCharacterCount(value: string): number {
  return value.length;
}

export function truncateToMaxCharacters(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  let truncated = '';
  let length = 0;

  for (const char of value) {
    const charLength = char.length;
    if (length + charLength > maxLength) {
      break;
    }

    truncated += char;
    length += charLength;
  }

  return truncated;
}
