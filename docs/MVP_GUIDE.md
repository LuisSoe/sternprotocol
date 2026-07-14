# STERN Protocol — MVP Technical Guide

This document explains what the MVP actually is, what is real vs. simulated, the trust and finality model we claim on stage, and the infrastructure decisions (database, hosting, deployment). Product/pitch strategy lives in [PRODUCT_PLAN.md](PRODUCT_PLAN.md); demo fill values live in [../DEMO_FILL_EXAMPLE.md](../DEMO_FILL_EXAMPLE.md).

---

## 1. What the MVP is

One deep slice: **the Settlement Engine**. A full escrow lifecycle that visibly works, fails correctly, and disputes correctly:

```
Pending ──(5 oracle checks pass + confirmation depth)──> Verified ──> Completed (funds → exporter, e-BL → importer)
Pending ──(deadline passes, importer claims)───────────────> Refunded
Pending/Verified ──(any party opens)──> Disputed ──(2-of-3 votes)──> Completed | Refunded
Pending/Verified ──(importer/exporter propose + counterparty approve)──> deadline extended (amendment)
```

Marketplace, RFQ, chat, reputation, traceability QR are intentionally **not** built — they are roadmap slides.

## 2. Real vs. conformance harness

| Layer | Status |
|---|---|
| Solidity escrow (`contracts/SternEscrow.sol`) | **Real.** 11 passing tests. Runs on local Hardhat today, Polygon Amoy when deployed. |
| Oracle gateway (`backend/oracle-gateway/`) | **Real.** Express service that signs and submits verification on-chain as the trusted oracle. |
| Dashboard (`frontend/`) | **Real.** Works with a wallet (on-chain mode) or without (mock mode fallback). |
| VGM / AIS / CEISA / IPFS / PSI feeds (`backend/mock-apis/`) | **Conformance harness.** Deterministic mocks that emit the same response *shape* as the real APIs. We mock the credentials, not the architecture — each mock is an adapter designed to be swapped for the real integration without touching the contract. |

The Settlement console exposes the harness openly (per-check PASS/FAIL toggles + raw payload viewer). Showing the unhappy path — one check fails, funds stay locked — is deliberate: it proves the release logic is real, not a hardcoded success.

## 3. Release condition — five checks

Funds release requires ALL of:

1. `vgmMatch` — container verified gross mass matches + gate-in confirmed (port IoT)
2. `aisDeparted` — vessel departure confirmed (AIS)
3. `ceisaApproved` — customs clearance / PEB approved (CEISA)
4. `eblCidValid` — e-BL document hash (IPFS CID) matches the contract
5. `inspectionPassed` — pre-shipment inspection certificate from the surveyor (Sucofindo/SGS mock)

…plus `block.number >= createdBlock + requiredConfirmations` — an immutable constructor parameter. `scripts/deploy.js` defaults to **5** locally (override with the `REQUIRED_CONFIRMATIONS` env var), so a local demo never waits on block mining; `npm run mine:128` still satisfies any depth.

**Who attests:** not a single trusted signer anymore. Verification requires a **2-of-3 consensus of independent bonded oracles** (`submitAttestation` per oracle; the contract computes per-check majority once the quorum is in). Each oracle posts a bond (`postBond`); an oracle whose attestation deviates from the finalized consensus is **slashed 50% of its remaining bond** automatically (`OracleSlashed`), its on-chain slash count acting as reputation, and slashed funds accrue to a treasury withdrawable by the owner. The oracle set and quorum are fixed at deployment — there is no function to swap oracles. Agreement on a *failing* check slashes no one: honest bad news is free; lying against the majority is expensive.

The 5th check is the answer to the "empty container" critique: shipment ≠ conformity, and conformity is attested by a PSI surveyor — exactly as it works in real FOB trade. The surveyor also holds the third key in the 2-of-3 dispute vote.

## 4. Trust model — say "trust-minimized", never "trustless"

Honest statement: release depends on oracle booleans (inspector, customs) that the contract takes on faith. A compromised oracle defeats the contract. What the system removes is **discretion and delay on the happy path** — once the declared oracles attest, settlement is instant and unarguable, instead of triggering weeks of manual bank document-checking. Humans stay exactly where they add value: inspection and dispute.

**Oracle-set governance** (the follow-up judges ask): the consortium is **fixed in the constructor — the contract has no function to add, remove, or replace an oracle**, so the operator cannot capture the verifier set at all. Bond and quorum are immutable too. Honesty note for the pitch: this is a *permissioned consortium with bonds*, not open-network cryptoeconomic security; auto-slashing the minority has a known failure mode (an honest minority can be slashed), which production mitigates with a challenge window (UMA/Chainlink-style) before a slash finalizes. Per-escrow oracle sets signed by the trading parties remain the roadmap refinement.

## 5. Finality story — seconds, with a circuit-breaker (verified 2026-07)

Verified facts: **Heimdall v2 went live 10 July 2025 and gives Polygon PoS ~5-second deterministic finality** (Polygon official blog + developer docs). On **10 September 2025** Polygon suffered a finality-lag incident (10–15 minutes behind, Bor/Erigon node issues — CoinDesk).

The pitch story: *finality is the chain's job (~5 seconds deterministic); on top of it the contract carries a **configurable confirmation depth** (`requiredConfirmations`, set at deployment) as a circuit-breaker for finality-lag incidents like September 2025.* Local demos deploy with depth 5 so settlement feels immediate; a cautious production deployment can raise it without code changes.

Consistency rule: **never say "128 blocks" or "~5 minutes" anywhere** — slides, script, or docs. The proposal's target 1.1 ("< 1 menit") and its "≥128 blok" section are both superseded by this story and must be revised in pitch materials.

## 6. Currency — IDRT-demo convention

- **UI displays `IDRT-demo`** everywhere (constant in `frontend/src/lib/currency.js`). On-chain value is still native local-chain ETH — the caption on Create/Settlement states this openly.
- A real ERC-20 IDRT-demo token + `transferFrom` escrow is **deferred** (separate branch if time allows): it costs a contract rewrite, two ABI syncs, and a 2-transaction MetaMask flow (approve + create) that is riskier live on stage.
- Production path: **Rupiah Digital (Proyek Garuda)** or tokenized bank deposits. Never USDC/USDT — banks become custodians and DHE account holders, not casualties.

## 7. DHE compliance (verified 2026-07)

PP 8/2025 (effective 1 March 2025): natural-resource export proceeds (mining excl. oil & gas, plantation, forestry, fisheries) with export value **≥ USD 250,000 per document** must be retained **100% for 12 months** in special DHE SDA accounts at national banks. Oil & gas stays under PP 36/2023.

- Programmable escrow can route released funds into DHE special accounts automatically — compliance-by-design, the strongest card in a Bank Indonesia room.
- Nuance to state before a judge does: individual UMKM shipments under USD 250k are exempt; the DHE feature bites for larger exporters and **aggregators** — which is also the go-to-market channel (one aggregator with 20 exporter members crosses the threshold and delivers the pilot numbers from one signature).

## 8. Infrastructure decisions

### Database: none for the MVP

- The **chain is the database** for escrow state (single source of truth, immutable audit trail).
- Mocks are deterministic — no persistence needed.
- The frontend is a static build; the gateway is stateless.

Add a database only when these features arrive, in this order of likelihood:
1. User accounts + custodial wallets (email login for UMKM)
2. Indexed transaction history / notifications (event indexing)
3. Marketplace / RFQ objects
4. Off-chain document storage metadata (invoices, packing lists)

**Recommendation when that day comes: Supabase** — Postgres fits relational trade documents, has built-in auth (solves custodial-wallet login), row-level security, and a generous free tier. Firebase is the alternative but its document model fits this domain worse and auth-plus-relational in one place is the main win.

### Hosting

| Piece | Where | Notes |
|---|---|---|
| Frontend (`frontend/dist`) | **Vercel** (and/or existing GitHub Pages) | Static Vite build — zero config, `base: "./"` already compatible. Set `VITE_CONTRACT_ADDRESS` + `VITE_ORACLE_API` as Vercel env vars. |
| Oracle gateway | **Render or Railway** (free tier) | It's a persistent Express server — deploys as-is. Vercel would require a serverless refactor; not worth it pre-hackathon. |
| Contract | **Polygon Amoy** testnet | The chain can't be "hosted" anywhere else; local Hardhat is not reachable by a public frontend. |

### Environment matrix

| Var | Local | Public demo |
|---|---|---|
| `RPC_URL` | `http://127.0.0.1:8545` | Amoy RPC (e.g. `https://rpc-amoy.polygon.technology`) |
| `CONTRACT_ADDRESS` | from `npm run deploy:local` | from Amoy deploy |
| `ORACLE_PRIVATE_KEYS` | Hardhat accounts #1,#4,#5 (comma-separated) | three dedicated testnet keys (never real-fund keys) |
| `AMOY_RPC_URL` / `DEPLOYER_PRIVATE_KEY` | unset | set for `hardhat run scripts/deploy.js --network amoy` |
| `VITE_CONTRACT_ADDRESS` / `VITE_ORACLE_API` | local values | Amoy address / Render URL |

## 9. Public deploy runbook (execute AFTER MVP sign-off — not yet done)

1. Get Amoy test POL from the [Polygon faucet](https://faucet.polygon.technology) into a **new throwaway wallet** (deployer = oracle for simplicity).
2. Set `AMOY_RPC_URL` + `DEPLOYER_PRIVATE_KEY` in `.env`, then `npx hardhat run scripts/deploy.js --network amoy`.
3. Deploy the gateway to Render: new Web Service → repo root → build `npm install` → start `node backend/oracle-gateway/index.js` → env vars `RPC_URL` (Amoy), `CONTRACT_ADDRESS`, `ORACLE_PRIVATE_KEYS` (the three consortium keys — fund each with a little faucet POL for gas, and post their bonds once via the deploy script or hardhat console).
4. Deploy the frontend to Vercel: root directory `frontend`, framework Vite, env `VITE_CONTRACT_ADDRESS` + `VITE_ORACLE_API` (Render URL).
5. Add the Amoy network to MetaMask (chainId 80002) and walk the Golden Path once with dummy testnet value.
6. Put the Amoy contract address + a PolygonScan Amoy explorer link on the pitch's final slide.

Reminder: contracts deployed before the 5-check upgrade are incompatible with the current gateway/frontend — always redeploy after pulling contract changes.

## 10. Validation baseline

- `npx hardhat test` — 16 passing (quorum release, pre-quorum hold, non-consortium/unbonded rejection, deviation slashing, agreed-failure lock without slash, dispute refund, deadline refund, double-release guard, double-vote guard, confirmation depth, constructor validation, extension happy path, self-approve guard, extension validation, dispute-clears-extension).
- `cd frontend && npm run build` — passing.
- Browser Golden Path (mock mode): unchecked → all attested → verified → released; inspection FAIL → locked; dissenting oracle → slashed while consensus passes; dispute 2-of-3 → refunded; amendment propose+approve.
