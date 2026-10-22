"use client";

import { useSyncExternalStore } from "react";

/** Minutes in a day: the band's scale. */
export const DAY = 1440;

export const mod = (n: number, m: number) => ((n % m) + m) % m;

function subscribeTick(onTick: () => void) {
  const id = window.setInterval(onTick, 1000);
  return () => window.clearInterval(id);
}

const subscribeNever = () => () => {};

/** The current minute (whole minutes since the epoch), ticking on the client; null on the server. */
export function useNowMinute(): number | null {
  return useSyncExternalStore(
    subscribeTick,
    () => Math.floor(Date.now() / 60000),
    () => null,
  );
}

/** The visitor's IANA zone ("Europe/London"); null on the server. */
export function useVisitorZone(): string | null {
  return useSyncExternalStore(
    subscribeNever,
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    () => null,
  );
}

const formats = new Map<string, Intl.DateTimeFormat>();

function formatFor(timeZone: string) {
  let format = formats.get(timeZone);
  if (!format) {
    format = new Intl.DateTimeFormat("en-GB", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
    });
    formats.set(timeZone, format);
  }
  return format;
}

/** The zone's offset from UTC in minutes at `minute` (epoch minutes): the wall clock read as UTC, minus the instant. */
export function zoneOffset(timeZone: string, minute: number): number {
  const parts: Record<string, number> = {};
  for (const part of formatFor(timeZone).formatToParts(minute * 60000)) {
    if (part.type !== "literal") parts[part.type] = Number(part.value);
  }
  const wall = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour % 24, parts.minute);
  return Math.round(wall / 60000 - minute);
}

/** 615 → "10:15". */
export function hhmm(minuteOfDay: number) {
  const m = mod(minuteOfDay, DAY);
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/** 330 → "5 h 30 min", 300 → "5 h", 30 → "30 min". */
export function spanWords(minutes: number) {
  const abs = Math.abs(minutes);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return [h ? `${h} h` : "", m ? `${m} min` : ""].filter(Boolean).join(" ");
}

/** 330 → "+5:30", -270 → "−4:30", 0 → "±0". */
export function spanShort(minutes: number) {
  if (minutes === 0) return "±0";
  const abs = Math.abs(minutes);
  return `${minutes > 0 ? "+" : "−"}${Math.floor(abs / 60)}:${String(abs % 60).padStart(2, "0")}`;
}

/**
 * "Europe/London" → "London", "America/Argentina/Buenos_Aires" → "Buenos Aires". Fixed-offset zones
 * get none: "Etc/GMT+5" is UTC−5 (POSIX signs), so its name would mislead.
 */
export function zoneCity(zone: string) {
  if (/^Etc\/GMT[+-]\d+$/.test(zone)) return "";
  const city = (zone.split("/").pop() ?? zone).replace(/_/g, " ");
  return RENAMED[city] ?? city;
}

/** Old IANA link names some systems still report. */
const RENAMED: Record<string, string> = { Calcutta: "Kolkata", Saigon: "Ho Chi Minh", Kiev: "Kyiv", Rangoon: "Yangon" };
