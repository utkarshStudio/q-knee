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

export function resolveImageUrl(path?: string): string | undefined {
  if (!path) return undefined;
  if (path.startsWith("data:") || path.startsWith("blob:") || path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }
  const isBrowser = typeof window !== "undefined";
  const isLocalhost = isBrowser && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
  const fallbackUrl = isLocalhost ? "http://localhost:3001" : "https://q-knee-api-jqnj.onrender.com";
  const baseUrl = import.meta.env.VITE_API_URL || fallbackUrl;
  const cleanBase = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  const token = isBrowser ? localStorage.getItem("hqml_token") : null;
  if (token) {
    const separator = cleanPath.includes("?") ? "&" : "?";
    return `${cleanBase}${cleanPath}${separator}token=${encodeURIComponent(token)}`;
  }
  return `${cleanBase}${cleanPath}`;
}

