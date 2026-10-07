/** Keep production links on the official domain during the domain migration.
 * Explicit local-development and non-legacy origins remain configurable. */
export function frontendUrl() {
  const canonical = 'https://nakathata.lk';
  try {
    const url = new URL(process.env.FRONTEND_URL || canonical);
    if (!['http:', 'https:'].includes(url.protocol)) return canonical;
    if (
      ['luxeevents.fun', 'www.luxeevents.fun', 'www.nakathata.lk'].includes(
        url.hostname,
      )
    )
      return canonical;
    return url.origin;
  } catch {
    return canonical;
  }
}
