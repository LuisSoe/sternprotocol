const STATE_STYLES = {
  Pending: "text-state-info border-state-info/40 bg-state-info/10",
  Verified: "text-brass-400 border-brass-400/40 bg-brass-400/10",
  Completed: "text-state-ok border-state-ok/40 bg-state-ok/10",
  Refunded: "text-paper-dim border-ink-600 bg-ink-700/40",
  Disputed: "text-state-warn border-state-warn/40 bg-state-warn/10"
};

export default function StatusPill({ state, children }) {
  const style = STATE_STYLES[state] || STATE_STYLES.Pending;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded border px-2 py-0.5 font-mono text-2xs font-medium uppercase tracking-wider ${style}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
      {children || state}
    </span>
  );
}
