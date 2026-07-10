export default function ActivityLog({ entries }) {
  if (!entries || entries.length === 0) {
    return <p className="text-xs text-paper-faint">No activity recorded yet.</p>;
  }

  return (
    <ol className="space-y-2.5">
      {[...entries].reverse().map((entry, index) => (
        <li key={`${entry.time}-${index}`} className="flex gap-2.5 text-xs">
          <span className="w-14 shrink-0 pt-px font-mono text-2xs text-paper-faint">
            {new Date(entry.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
          <span className="min-w-0">
            <span className="capitalize text-paper-dim">{entry.actor}</span>{" "}
            <span className="text-paper">{entry.event}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}
