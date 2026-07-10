import { useEffect, useRef, useState } from "react";
import { ChevronsUpDown, FilePlus2, LayoutList, RadioTower, RotateCcw, ShieldCheck } from "lucide-react";
import { ACTORS, actorById, shortAddress } from "../lib/actors.js";
import { getHealth } from "../lib/api.js";

const NAV = [
  { id: "overview", label: "Escrows", icon: LayoutList },
  { id: "create", label: "New escrow", icon: FilePlus2 }
];

export default function Sidebar({ view, onNavigate, role, onRoleChange, onResetDemo, isOnChainReady }) {
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [oracleOnline, setOracleOnline] = useState(null);
  const switcherRef = useRef(null);
  const actor = actorById(role);

  useEffect(() => {
    function onClickOutside(event) {
      if (switcherRef.current && !switcherRef.current.contains(event.target)) {
        setSwitcherOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function ping() {
      try {
        const health = await getHealth();
        if (!cancelled) setOracleOnline(Boolean(health.ok));
      } catch {
        if (!cancelled) setOracleOnline(false);
      }
    }

    ping();
    const interval = setInterval(ping, 30000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return (
    <aside className="flex h-full w-60 shrink-0 flex-col border-r border-ink-700 bg-ink-900">
      <div className="flex items-center gap-2.5 border-b border-ink-700 px-4 py-4">
        <div className="grid h-8 w-8 place-items-center rounded bg-brass-400/15 text-brass-400">
          <ShieldCheck size={17} aria-hidden="true" />
        </div>
        <div>
          <p className="font-mono text-sm font-semibold tracking-wide text-paper">STERN</p>
          <p className="text-2xs uppercase tracking-widest text-paper-faint">Settlement engine</p>
        </div>
      </div>

      <nav className="flex-1 px-2 py-3" aria-label="Primary">
        <p className="px-2 pb-2 text-2xs font-medium uppercase tracking-widest text-paper-faint">
          Workspace
        </p>
        {NAV.map((item) => {
          const Icon = item.icon;
          const active = view === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id)}
              aria-current={active ? "page" : undefined}
              className={`mb-0.5 flex w-full cursor-pointer items-center gap-2.5 rounded px-2.5 py-2 text-left text-sm transition-colors duration-150 ${
                active
                  ? "bg-brass-400/10 font-medium text-brass-300"
                  : "text-paper-dim hover:bg-ink-800 hover:text-paper"
              }`}
            >
              <Icon size={15} aria-hidden="true" />
              {item.label}
            </button>
          );
        })}
      </nav>

      <div className="border-t border-ink-700 px-3 py-3">
        <div className="mb-1.5 flex items-center justify-between px-1">
          <span className="text-2xs uppercase tracking-widest text-paper-faint">
            {isOnChainReady ? "Local chain · 31337" : "Mock session"}
          </span>
          <span
            className={`h-1.5 w-1.5 rounded-full ${isOnChainReady ? "bg-state-ok" : "bg-state-warn"}`}
            title={isOnChainReady ? "Wallet + contract detected" : "No wallet/contract — local mock state"}
          />
        </div>
        <div
          className="mb-2 flex items-center justify-between px-1"
          title="The oracle gateway is the trusted signer that submits the five verification checks on-chain (backend/oracle-gateway, port 4000)"
        >
          <span className="flex items-center gap-1.5 text-2xs uppercase tracking-widest text-paper-faint">
            <RadioTower size={11} aria-hidden="true" />
            Oracle gateway
          </span>
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              oracleOnline === null ? "bg-ink-600" : oracleOnline ? "bg-state-ok" : "bg-state-fail"
            }`}
            title={
              oracleOnline === null
                ? "Checking oracle gateway…"
                : oracleOnline
                  ? "Oracle gateway online at :4000"
                  : "Oracle gateway offline — run: npm run backend"
            }
          />
        </div>

        <div ref={switcherRef} className="relative">
          {switcherOpen ? (
            <div className="absolute bottom-full left-0 right-0 z-30 mb-1 rounded border border-ink-600 bg-ink-850 py-1 shadow-xl">
              {ACTORS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => {
                    onRoleChange(option.id);
                    setSwitcherOpen(false);
                  }}
                  className={`flex w-full cursor-pointer items-start gap-2.5 px-3 py-2 text-left transition-colors duration-150 hover:bg-ink-800 ${
                    option.id === role ? "text-brass-300" : "text-paper"
                  }`}
                >
                  <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded bg-ink-700 font-mono text-2xs uppercase">
                    {option.label[0]}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-xs font-medium">{option.label}</span>
                    <span className="block truncate text-2xs text-paper-faint">{option.org}</span>
                    <span className="block font-mono text-2xs text-paper-faint">
                      {shortAddress(option.address)}
                    </span>
                  </span>
                </button>
              ))}
              <div className="mt-1 border-t border-ink-700 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    onResetDemo();
                    setSwitcherOpen(false);
                  }}
                  className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-xs text-paper-dim transition-colors duration-150 hover:bg-ink-800 hover:text-paper"
                >
                  <RotateCcw size={13} aria-hidden="true" />
                  Reset demo data
                </button>
              </div>
            </div>
          ) : null}

          <button
            type="button"
            onClick={() => setSwitcherOpen((open) => !open)}
            aria-expanded={switcherOpen}
            aria-label={`Acting as ${actor.label} — switch actor`}
            className="flex w-full cursor-pointer items-center gap-2.5 rounded border border-ink-700 bg-ink-850 px-2.5 py-2 text-left transition-colors duration-150 hover:border-ink-600"
          >
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded bg-brass-400/15 font-mono text-xs font-semibold uppercase text-brass-400">
              {actor.label[0]}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-medium text-paper">{actor.label}</span>
              <span className="block truncate font-mono text-2xs text-paper-faint">
                {shortAddress(actor.address)}
              </span>
            </span>
            <ChevronsUpDown size={13} className="shrink-0 text-paper-faint" aria-hidden="true" />
          </button>
        </div>
      </div>
    </aside>
  );
}
