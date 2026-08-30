import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleString("en-US", {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}
export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) return "\u2014";
  return `${(value * 100).toFixed(1)}%`;
}
export function formatMetric(value: number | null | undefined, decimals = 3): string {
  if (value === null || value === undefined) return "\u2014";
  return value.toFixed(decimals);
}
export type Mode = "REAL" | "SIMULATION" | "DEMO";
export type Role = "researcher" | "admin";
