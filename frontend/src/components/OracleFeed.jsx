import { CheckCircle2, CircleDashed } from "lucide-react";

export default function OracleFeed({ items }) {
  return (
    <div className="space-y-3">
      {items.map((item) => {
        const Icon = item.ok ? CheckCircle2 : CircleDashed;

        return (
          <div key={item.label} className="flex items-center gap-3 rounded-md border border-stern-line bg-slate-950/40 p-3">
            <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-md ${item.ok ? "bg-emerald-300/10 text-emerald-200" : "bg-slate-700/50 text-slate-400"}`}>
              <Icon size={18} aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-100">{item.label}</p>
              <p className="truncate text-xs text-slate-500">{item.detail}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
