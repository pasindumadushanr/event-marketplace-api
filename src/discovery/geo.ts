export type Coordinates = { latitude: number; longitude: number };

export function coordinates(value: unknown): Coordinates | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const { latitude, longitude } = value as Partial<Coordinates>;
  if (
    typeof latitude !== 'number' ||
    !Number.isFinite(latitude) ||
    latitude < -90 ||
    latitude > 90 ||
    typeof longitude !== 'number' ||
    !Number.isFinite(longitude) ||
    longitude < -180 ||
    longitude > 180
  )
    return null;
  return { latitude, longitude };
}

export function distanceKm(a: Coordinates, b: Coordinates): number {
  const radians = (n: number) => (n * Math.PI) / 180;
  const dLat = radians(b.latitude - a.latitude);
  const dLng = radians(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(radians(a.latitude)) *
      Math.cos(radians(b.latitude)) *
      Math.sin(dLng / 2) ** 2;
  return 6371.0088 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, h))));
}
