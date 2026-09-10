import { endOfDay, endOfMonth, endOfYear, startOfDay, startOfMonth, startOfYear } from "date-fns";

export type PeriodMode = "all" | "day" | "month" | "year";

export type PeriodRange = { start: Date; end: Date } | null;

export function dayRange(date: Date): PeriodRange {
  return { start: startOfDay(date), end: endOfDay(date) };
}

export function monthRange(year: number, month: number): PeriodRange {
  const date = new Date(year, month, 1);
  return { start: startOfMonth(date), end: endOfMonth(date) };
}

export function yearRange(year: number): PeriodRange {
  const date = new Date(year, 0, 1);
  return { start: startOfYear(date), end: endOfYear(date) };
}

export function isWithinRange(date: Date, range: PeriodRange): boolean {
  if (!range) return true;
  return date >= range.start && date <= range.end;
}
