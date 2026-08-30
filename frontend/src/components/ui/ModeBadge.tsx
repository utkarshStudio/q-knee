type Mode = "REAL" | "SIMULATION" | "DEMO";
const styles: Record<Mode, string> = {
  REAL: "bg-emerald-100 text-emerald-800",
  SIMULATION: "bg-blue-100 text-blue-800",
  DEMO: "bg-amber-100 text-amber-800",
};
export function ModeBadge({ mode }: { mode: Mode }) {
  return <span className={"inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold " + (styles[mode] || styles.DEMO)}>{mode}</span>;
}