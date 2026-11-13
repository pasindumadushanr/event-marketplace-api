const sriLankaOffset = 330 * 60 * 1000;

/** Two calendar months in Sri Lanka, clamped to the last day of shorter months. */
export function vendorTrial(createdAt: Date, now = new Date()) {
  const startsAt = new Date(createdAt);
  if (!Number.isFinite(startsAt.getTime()))
    throw new Error('Invalid registration date');
  const local = new Date(startsAt.getTime() + sriLankaOffset);
  const day = local.getUTCDate();
  const month = local.getUTCMonth() + 2;
  const lastDay = new Date(
    Date.UTC(local.getUTCFullYear(), month + 1, 0),
  ).getUTCDate();
  local.setUTCDate(1);
  local.setUTCMonth(month);
  local.setUTCDate(Math.min(day, lastDay));
  const endsAt = new Date(local.getTime() - sriLankaOffset);
  return {
    startsAt: startsAt.toISOString(),
    endsAt: endsAt.toISOString(),
    status: now >= endsAt ? 'EXPIRED' : 'ACTIVE',
    automaticCharge: false,
    hidePageOnExpiry: false,
  };
}
