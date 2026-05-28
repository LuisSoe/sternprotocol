export default function StatCard({ label, value, helper, icon: Icon }) {
  return (
    <section className="rounded-md border border-stern-line bg-stern-panel p-4 shadow-glow">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-slate-400">{label}</p>
          <p className="mt-2 text-2xl font-semibold tracking-normal text-slate-50">{value}</p>
        </div>
        {Icon ? (
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-cyan-300/10 text-cyan-200">
            <Icon size={19} aria-hidden="true" />
          </div>
        ) : null}
      </div>
      {helper ? <p className="mt-3 text-xs text-slate-500">{helper}</p> : null}
    </section>
  );
}
