export function mergeProfileSettings(
  previous: Record<string, any>,
  changes: Record<string, any>,
): Record<string, any> {
  const result = { ...previous };
  for (const [key, value] of Object.entries(changes)) {
    if (['__proto__', 'constructor', 'prototype'].includes(key)) continue;
    result[key] =
      value && typeof value === 'object' && !Array.isArray(value)
        ? mergeProfileSettings(
            result[key] &&
              typeof result[key] === 'object' &&
              !Array.isArray(result[key])
              ? result[key]
              : {},
            value,
          )
        : value;
  }
  return result;
}
