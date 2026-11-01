// Public media only. Identity documents must never use this storage endpoint.
export function r2PublicOrigin(
  value = process.env.R2_PUBLIC_URL,
): string | undefined {
  if (!value?.trim()) return undefined;
  const url = new URL(value.trim());
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.port ||
    url.pathname !== '/' ||
    url.search ||
    url.hash ||
    url.hostname === 'localhost' ||
    (process.env.NODE_ENV === 'production' && url.hostname.endsWith('.r2.dev'))
  )
    throw new Error(
      'R2_PUBLIC_URL must be an HTTPS image domain origin; use a custom domain in production',
    );
  return url.origin;
}

export function r2ObjectKey(
  value: string,
  origin = r2PublicOrigin(),
): string | undefined {
  if (!origin) return undefined;
  try {
    const url = new URL(value);
    if (
      url.origin !== origin ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      return undefined;
    const key = url.pathname.slice(1);
    if (
      !/^event_marketplace\/(?:[a-z0-9_-]+\/)*[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(?:jpg|png|webp|mp4)$/.test(
        key,
      )
    )
      return undefined;
    return key;
  } catch {
    return undefined;
  }
}
