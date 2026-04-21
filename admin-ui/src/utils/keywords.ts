export function splitKeywordString(value?: string | null): string[] {
  if (!value) {
    return [];
  }

  const seen = new Set<string>();
  return value
    .split(/[,\n]/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .filter((entry) => {
      const key = entry.toLowerCase();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
}

export function joinKeywordTokens(tokens: string[]): string {
  return tokens.map((token) => token.trim()).filter((token) => token.length > 0).join(', ');
}
