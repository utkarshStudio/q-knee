type Status = "online" | "offline" | "loading" | "unknown";
const colors: Record<Status, string> = {
  online: "bg-emerald-500", offline: "bg-red-500", loading: "bg-amber-500 animate-pulse", unknown: "bg-slate-400",
};
export function StatusIndicator({ status, label }: { status: Status; label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <div className={"w-2 h-2 rounded-full " + (colors[status] || colors.unknown)} />
      <span className="text-slate-600">{label}</span>
    </div>
  );
}