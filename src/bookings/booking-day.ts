import { BadRequestException } from '@nestjs/common';

// Event dates are calendar days, stored at UTC midnight (not appointment times).
export function bookingDay(value: string | Date) {
  const key =
    value instanceof Date
      ? value.toISOString().slice(0, 10)
      : String(value).slice(0, 10);
  const date = new Date(`${key}T00:00:00.000Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(key) ||
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== key
  )
    throw new BadRequestException('Choose a valid event date');
  return { key, date, end: new Date(date.getTime() + 86400000) };
}

export function todayInSriLanka() {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'Asia/Colombo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const part = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}
