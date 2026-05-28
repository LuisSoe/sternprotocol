const toneMap = {
  success: "border-emerald-300/30 bg-emerald-300/10 text-emerald-200",
  pending: "border-cyan-300/30 bg-cyan-300/10 text-cyan-200",
  warning: "border-amber-300/30 bg-amber-300/10 text-amber-200",
  muted: "border-slate-500/30 bg-slate-500/10 text-slate-300"
};

export default function StatusBadge({ children, tone = "muted" }) {
  return (
    <span className={`inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-medium ${toneMap[tone]}`}>
      {children}
    </span>
  );
}
