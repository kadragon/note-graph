export function getCharacterCount(value: string): number {
  return Array.from(value).length;
}

export function truncateToMaxCharacters(value: string, maxLength: number): string {
  const characters = Array.from(value);
  if (characters.length <= maxLength) {
    return value;
  }

  return characters.slice(0, maxLength).join('');
}
