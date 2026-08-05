export interface BusinessHour {
  weekday: number;
  isOpen: boolean;
  startTime: string;
  endTime: string;
}

export const BUSINESS_WEEKDAYS = [
  'Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira',
  'Quinta-feira', 'Sexta-feira', 'Sábado',
];

export const DEFAULT_BUSINESS_HOURS: BusinessHour[] = [
  { weekday: 0, isOpen: false, startTime: '09:00', endTime: '18:00' },
  { weekday: 1, isOpen: false, startTime: '09:00', endTime: '18:00' },
  { weekday: 2, isOpen: true, startTime: '09:00', endTime: '17:00' },
  { weekday: 3, isOpen: true, startTime: '09:00', endTime: '17:00' },
  { weekday: 4, isOpen: true, startTime: '09:00', endTime: '17:00' },
  { weekday: 5, isOpen: true, startTime: '09:00', endTime: '17:00' },
  { weekday: 6, isOpen: true, startTime: '09:00', endTime: '19:00' },
];

export function normalizeBusinessHours(value?: BusinessHour[] | null): BusinessHour[] {
  return DEFAULT_BUSINESS_HOURS.map((fallback) => {
    const item = value?.find((candidate) => candidate.weekday === fallback.weekday);
    return item ? { ...fallback, ...item, weekday: fallback.weekday } : { ...fallback };
  });
}

export function timeToMinutes(value: string): number {
  const [hours, minutes] = value.split(':').map(Number);
  return (hours || 0) * 60 + (minutes || 0);
}
