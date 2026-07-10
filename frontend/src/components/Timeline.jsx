import { Check, Scale, Undo2 } from "lucide-react";

const MAIN_STEPS = [
  { key: "Pending", label: "Funds locked", detail: "Importer deposit held by the contract" },
  { key: "Verified", label: "Oracle verified", detail: "All five checks attested on-chain" },
  { key: "Completed", label: "Settled", detail: "Funds to exporter · e-BL to importer" }
];

export default function Timeline({ state }) {
  const isDisputed = state === "Disputed";
  const isRefunded = state === "Refunded";
  const activeIndex = MAIN_STEPS.findIndex((step) => step.key === state);

  function stepStatus(index) {
    if (isDisputed || isRefunded) return index === 0 ? "done" : "off";
    if (index < activeIndex) return "done";
    if (index === activeIndex) return "current";
    return "off";
  }

  return (
    <ol className="relative">
      {MAIN_STEPS.map((step, index) => {
        const status = stepStatus(index);
        const last = index === MAIN_STEPS.length - 1;

        return (
          <li key={step.key} className="relative flex gap-3 pb-5 last:pb-0">
            {!last ? (
              <span
                aria-hidden="true"
                className={`absolute left-[11px] top-6 h-[calc(100%-1.25rem)] w-px ${
                  status === "done" ? "bg-brass-400/50" : "bg-ink-700"
                }`}
              />
            ) : null}
            <span
              className={`relative z-10 grid h-6 w-6 shrink-0 place-items-center rounded-full border font-mono text-2xs ${
                status === "done"
                  ? "border-brass-400/60 bg-brass-400/15 text-brass-400"
                  : status === "current"
                    ? "border-brass-400 bg-brass-400 text-ink-950"
                    : "border-ink-700 bg-ink-900 text-paper-faint"
              }`}
            >
              {status === "done" ? <Check size={12} aria-hidden="true" /> : index + 1}
            </span>
            <div className="min-w-0 pt-0.5">
              <p
                className={`text-xs font-medium ${
                  status === "off" ? "text-paper-faint" : "text-paper"
                }`}
              >
                {step.label}
              </p>
              <p className="text-2xs text-paper-faint">{step.detail}</p>
            </div>
          </li>
        );
      })}

      {isDisputed ? (
        <li className="mt-1 flex items-center gap-2 rounded border border-state-warn/40 bg-state-warn/10 px-2.5 py-2 text-xs text-state-warn">
          <Scale size={13} aria-hidden="true" />
          Disputed — funds frozen until a 2-of-3 party vote resolves it
        </li>
      ) : null}
      {isRefunded ? (
        <li className="mt-1 flex items-center gap-2 rounded border border-ink-600 bg-ink-800 px-2.5 py-2 text-xs text-paper-dim">
          <Undo2 size={13} aria-hidden="true" />
          Refunded — escrow value returned to the importer
        </li>
      ) : null}
    </ol>
  );
}
