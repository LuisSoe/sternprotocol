import { useCallback, useMemo, useState } from "react";
import Sidebar from "./components/Sidebar.jsx";
import Overview from "./pages/Overview.jsx";
import NewEscrow from "./pages/NewEscrow.jsx";
import EscrowDetail from "./pages/EscrowDetail.jsx";

export default function App() {
  const [role, setRole] = useState("importer");
  const [view, setView] = useState({ name: "overview" });
  const [escrows, setEscrows] = useState([]);

  const hasContractAddress = Boolean(import.meta.env.VITE_CONTRACT_ADDRESS);
  const hasInjectedWallet = typeof window !== "undefined" && Boolean(window.ethereum);
  const isOnChainReady = hasContractAddress && hasInjectedWallet;

  const updateEscrow = useCallback((id, updater) => {
    setEscrows((current) =>
      current.map((escrow) => (escrow.id === id ? updater(escrow) : escrow))
    );
  }, []);

  const addEscrow = useCallback((record) => {
    setEscrows((current) => [record, ...current.filter((escrow) => escrow.id !== record.id)]);
    setView({ name: "escrow", id: record.id });
  }, []);

  // Merge chain rows into the registry, keeping any local session data
  // (activity log, harness state) for escrows we already know about.
  const syncChainEscrows = useCallback((rows) => {
    setEscrows((current) => {
      const known = new Map(current.map((escrow) => [escrow.id, escrow]));
      const merged = rows.map((row) => {
        const existing = known.get(row.id);
        return existing
          ? { ...existing, ...row, activity: existing.activity, votes: existing.votes }
          : {
              ...row,
              createdAt: null,
              verification: null,
              votes: { importer: null, exporter: null, arbiter: null },
              pendingExtension: null,
              activity: []
            };
      });
      const mockOnly = current.filter(
        (escrow) => escrow.source === "mock" && !rows.some((row) => row.id === escrow.id)
      );
      return [...mockOnly, ...merged];
    });
  }, []);

  const resetDemo = useCallback(() => {
    setEscrows((current) => current.filter((escrow) => escrow.source === "chain"));
    setView({ name: "overview" });
  }, []);

  const activeEscrow = useMemo(
    () => (view.name === "escrow" ? escrows.find((escrow) => escrow.id === view.id) : null),
    [view, escrows]
  );

  return (
    <div className="flex h-dvh overflow-hidden bg-ink-950 text-paper">
      <Sidebar
        view={view.name}
        onNavigate={(name) => setView({ name })}
        role={role}
        onRoleChange={setRole}
        onResetDemo={resetDemo}
        isOnChainReady={isOnChainReady}
      />

      <main className="flex-1 overflow-y-auto px-6 py-6 lg:px-10 lg:py-8">
        {view.name === "create" ? (
          <NewEscrow
            role={role}
            isOnChainReady={isOnChainReady}
            onCreated={addEscrow}
            onBack={() => setView({ name: "overview" })}
          />
        ) : view.name === "escrow" && activeEscrow ? (
          <EscrowDetail
            escrow={activeEscrow}
            role={role}
            isOnChainReady={isOnChainReady}
            onUpdate={updateEscrow}
            onBack={() => setView({ name: "overview" })}
          />
        ) : (
          <Overview
            escrows={escrows}
            isOnChainReady={isOnChainReady}
            onOpen={(id) => setView({ name: "escrow", id })}
            onCreate={() => setView({ name: "create" })}
            onChainSync={syncChainEscrows}
          />
        )}
      </main>
    </div>
  );
}
