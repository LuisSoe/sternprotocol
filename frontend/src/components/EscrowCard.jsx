import { ArrowRight, Container, FileCheck2 } from "lucide-react";
import StatusBadge from "./StatusBadge.jsx";

export default function EscrowCard({ escrow }) {
  return (
    <article className="rounded-md border border-stern-line bg-stern-panel p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-100">{escrow.commodity}</p>
          <p className="mt-1 text-xs text-slate-400">{escrow.id}</p>
        </div>
        <StatusBadge tone={escrow.statusTone}>{escrow.status}</StatusBadge>
      </div>
      <div className="mt-4 grid gap-3 text-sm text-slate-300 sm:grid-cols-3">
        <div className="flex items-center gap-2">
          <Container size={16} className="text-cyan-200" aria-hidden="true" />
          {escrow.container}
        </div>
        <div className="flex items-center gap-2">
          <FileCheck2 size={16} className="text-teal-200" aria-hidden="true" />
          {escrow.cid}
        </div>
        <div className="flex items-center gap-2 font-medium text-slate-50">
          {escrow.value}
          <ArrowRight size={15} className="text-slate-500" aria-hidden="true" />
          Exporter
        </div>
      </div>
    </article>
  );
}
