export const FIT_MARKER = "[barberone:fit]";

export function isFitAppointment(notes: string | null | undefined): boolean {
  return typeof notes === "string" && notes.includes(FIT_MARKER);
}

export function cleanFitMarker(notes: string | null | undefined): string {
  return String(notes ?? "")
    .replace(FIT_MARKER, "")
    .trim();
}

export function buildFitNotes(userNotes: string | null | undefined): string {
  const trimmed = String(userNotes ?? "").trim();
  return trimmed ? `${trimmed} ${FIT_MARKER}` : FIT_MARKER;
}

export interface FreeInterval {
  startMinutes: number;
  endMinutes: number;
  durationMinutes: number;
  startTime: string;
  endTime: string;
}

export interface OccupiedSlot {
  startMinutes: number;
  endMinutes: number;
}

export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60).toString().padStart(2, "0");
  const m = (minutes % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

export function isoToSaoPauloMinutes(isoString: string): number {
  const date = new Date(isoString);
  const formatted = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
  const [h, m] = formatted.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}min`;
}

export function getFreeIntervals(
  occupied: OccupiedSlot[],
  openMinutes: number,
  closeMinutes: number,
  minDurationMinutes = 15,
): FreeInterval[] {
  const sorted = occupied
    .filter((s) => s.endMinutes > openMinutes && s.startMinutes < closeMinutes)
    .map((s) => ({
      startMinutes: Math.max(s.startMinutes, openMinutes),
      endMinutes: Math.min(s.endMinutes, closeMinutes),
    }))
    .sort((a, b) => a.startMinutes - b.startMinutes);

  const merged: OccupiedSlot[] = [];
  for (const slot of sorted) {
    const last = merged[merged.length - 1];
    if (last && slot.startMinutes <= last.endMinutes) {
      last.endMinutes = Math.max(last.endMinutes, slot.endMinutes);
    } else {
      merged.push({ ...slot });
    }
  }

  const intervals: FreeInterval[] = [];
  let cursor = openMinutes;

  for (const slot of merged) {
    const duration = slot.startMinutes - cursor;
    if (duration >= minDurationMinutes) {
      intervals.push({
        startMinutes: cursor,
        endMinutes: slot.startMinutes,
        durationMinutes: duration,
        startTime: minutesToTime(cursor),
        endTime: minutesToTime(slot.startMinutes),
      });
    }
    cursor = Math.max(cursor, slot.endMinutes);
  }

  const trailing = closeMinutes - cursor;
  if (trailing >= minDurationMinutes) {
    intervals.push({
      startMinutes: cursor,
      endMinutes: closeMinutes,
      durationMinutes: trailing,
      startTime: minutesToTime(cursor),
      endTime: minutesToTime(closeMinutes),
    });
  }

  return intervals;
}
