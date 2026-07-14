# STERN Protocol Demo Fill Example

This file gives exact example values you can use when demoing the MVP.

The full 6-minute demo script (the "Golden Path") is in `docs/PRODUCT_PLAN.md` section 3. This file gives the exact values and clicks.

## 0. Session Switcher (bottom-left of the sidebar)

The app is a sidebar workspace: **Escrows** (list + stats), **New escrow** (validated form), and the **escrow detail workspace** (opened by clicking a row). The account card at the **bottom of the sidebar** switches which actor you are acting as — Importer / Exporter / Arbiter — like an account switcher in a real app. It also has **Reset demo data** to clear the mock session between rehearsals.

Role gating in the escrow workspace:

```text
Importer: release, refund, open dispute, vote, propose/approve amendment
Exporter: release, open dispute, vote, propose/approve amendment
Arbiter:  open dispute, vote (the inspection body's third key)
```

In mock mode the role also decides whose dispute vote you are casting. In wallet mode, switch your MetaMask account to the matching address before acting.

## 1. Simple UI Demo

Use this if you only want to show the dashboard, mock e-BL upload, and oracle feed. You do not need MetaMask for this path.

### Start Backend

From the project root:

```bash
npm run backend
```

Backend URL:

```text
http://localhost:4000
```

### Start Frontend

In another terminal:

```bash
cd frontend
npm run dev
```

Open the URL shown by Vite, usually:

```text
http://127.0.0.1:5173
```

## 2. New Escrow Form Example

Open **New escrow** (sidebar) as the **Importer** and fill it like this. Every field is validated inline (addresses must be real Ethereum addresses, the deadline must be at least 1 hour in the future, exporter ≠ arbiter, and so on) — the submit button explains what is missing.

```text
Exporter wallet:
0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC

Arbiter wallet:
0x90F79bf6EB2c4f870365E785982E1f101E93b906

Contract value (IDRT-demo):
1

Commodity:
Indonesian Robusta Coffee

Container reference:
TGHU-2026-001

Deadline:
Pick any date/time at least 1 day in the future
```

For the **e-BL document**, pick any real file (a PDF works well). The app hashes the file locally with SHA-256 and shows a content identifier like:

```text
bafybeisternwkbxfzyxpofpsbutqohndbyq...
```

Same file, same CID — that is the point: the contract anchors the document's content, not its name.

Then click:

```text
Lock funds in escrow
```

Without a wallet this creates local mock state; with MetaMask + VITE_CONTRACT_ADDRESS it sends the real transaction. Either way you land in the escrow workspace.

## 3. Settlement Screen Example

Open the escrow by clicking its row in the **Escrows** table. The workspace has three zones: **Lifecycle** (timeline + amendment), **Oracle verification** (five checks + conformance harness + raw payloads), and **Actions** (role-gated) with the **Activity log**.

The five checks start as **unchecked** (gray) — this is intentional; nothing is claimed before data is fetched.

Click:

```text
Refresh oracle feed
```

Expected result:

```text
VGM match: attested
Vessel departed: attested
Customs approved: attested
e-BL hash valid: attested
Inspection passed: attested
```

Expand **Raw source payloads** to show the judges that each mock emits the real API response shape (VGM, AIS, CEISA, IPFS, PSI certificate).

The header shows locked value and net-to-exporter (0.5% indicative platform fee). IDRT-demo is a display unit (1 IDRT-demo = 1 local chain unit). The production path is Rupiah Digital / tokenized bank deposits.

### 3a. Happy Path (mock mode)

```text
1. Refresh oracle feed  -> all five checks attested
2. Submit verification  -> escrow marked Verified
3. Release settlement   -> timeline reaches Settled, funds released to exporter
```

Every step lands in the Activity log with actor + timestamp.

### 3b. Fraud Case — the most important 30 seconds of the demo

In the **Conformance harness** strip, click a toggle to flip one check:

```text
VGM ✓ -> ✗        (story: container weight mismatch / empty container)
   or
Inspection ✓ -> ✗ (story: PSI surveyor found goods do not match contract)
```

Then:

```text
1. Refresh oracle feed -> the failed check turns red ("failed")
2. Submit verification -> "checks failed — funds stay locked"
3. Release settlement  -> rejected: "Conditions not met"
```

Narration: the system does not trust the exporter; it trusts the data. If the data does not match, not a single rupiah moves.

### 3c. Dispute 2-of-3 (mock mode)

```text
1. As Importer: Open dispute            -> funds frozen, vote panel appears
2. As Importer: Vote refund to importer -> 1 vote recorded
3. Switch actor to Arbiter (sidebar, bottom-left)
4. As Arbiter: Vote refund to importer  -> resolved 2-of-3, timeline shows Refunded
```

### 3d. Dissenting Oracle — the cryptoeconomic scene

The **Oracle consortium** panel shows the three verifiers (Sucofindo, SGS, Port Authority), each with a posted bond. Verification needs a 2-of-3 consensus.

```text
1. In the harness, set "Dissenting oracle" to SGS  (story: one verifier is bribed)
2. Submit verification
3. Watch the panel: SGS -> SLASHED, bond 1.00 -> 0.50
   Consensus still passes 2-of-3 and the escrow verifies anyway
```

Narration: we don't trust one institution — we trust consensus between institutions, bound by economic incentives. Lying against the majority costs half your bond; agreeing on bad news costs nothing.

### 3e. Amendment — Extend Deadline (mock mode)

In the **Amendment** card (under the Lifecycle timeline):

```text
1. As Exporter: pick a later date/time, click Propose  (story: vessel delayed by weather)
2. Switch actor to Importer (sidebar)
3. As Importer: click Approve -> deadline extended without cancelling the contract
```

The proposer cannot approve their own extension — try it and the app tells you so (same rule as the contract).

This is the answer to "code is law is too rigid."

For a UI-only demo, stop here.

## 4. Full Blockchain Demo With MetaMask

Use this when you want real local transactions.

### Step 1: Start Hardhat Node

From the project root:

```bash
npx hardhat node
```

Hardhat will print test accounts. Use these common local addresses:

```text
Account #0 Importer:
0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266

Account #1 Oracle:
0x70997970C51812dc3A010C7d01b50e0d17dc79C8

Account #2 Exporter:
0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC

Account #3 Arbiter:
0x90F79bf6EB2c4f870365E785982E1f101E93b906
```

Use the private keys printed by your own Hardhat node. Do not use these accounts on real networks.

### Step 2: Add Hardhat Network To MetaMask

In MetaMask, add a custom network:

```text
Network name:
Hardhat Local

RPC URL:
http://127.0.0.1:8545

Chain ID:
31337

Currency symbol:
ETH
```

### Step 3: Import Local Importer Account

Import Account #0 private key from the Hardhat node output into MetaMask.

This account has dummy local ETH. It is safe for local demo only.

### Step 4: Deploy Contract

Open another terminal from the project root:

```bash
npm run deploy:local
```

You will see output like:

```text
SternEscrow deployed to: 0xABC123...
Owner: 0xf39...
Trusted oracle: 0x709...
```

Copy the deployed contract address.

### Step 5: Fill Root `.env`

Create or edit:

```text
.env
```

Example:

```text
RPC_URL=http://127.0.0.1:8545
CONTRACT_ADDRESS=PASTE_DEPLOYED_CONTRACT_ADDRESS_HERE
ORACLE_PRIVATE_KEYS=KEY_OF_ACCOUNT_1,KEY_OF_ACCOUNT_4,KEY_OF_ACCOUNT_5
PORT=4000
```

Important:

```text
ORACLE_PRIVATE_KEYS must be the three consortium accounts printed during deploy
(Hardhat accounts #1, #4, #5 — the deploy script registers them and posts their bonds).
```

### Step 6: Fill Frontend Env

Create:

```text
frontend/.env
```

Example:

```text
VITE_CONTRACT_ADDRESS=PASTE_DEPLOYED_CONTRACT_ADDRESS_HERE
VITE_ORACLE_API=http://localhost:4000
```

### Step 7: Restart Backend And Frontend

Backend:

```bash
npm run backend
```

Frontend:

```bash
cd frontend
npm run dev
```

### Step 8: Create Escrow On-Chain

In the frontend **Create** screen, fill:

```text
Importer wallet:
Your connected MetaMask account, usually Account #0

Exporter wallet:
0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC

Arbiter wallet:
0x90F79bf6EB2c4f870365E785982E1f101E93b906

Contract value (IDRT-demo):
1

Commodity:
Indonesian Robusta Coffee

Container reference:
TGHU-2026-001

Deadline:
Tomorrow or later
```

Attach any real file as the e-BL document (it is hashed locally into the CID), then click:

```text
Lock funds in escrow
```

MetaMask should ask you to confirm the transaction.

### Step 9: Confirmation Depth (usually nothing to do)

`scripts/deploy.js` deploys with a confirmation depth of **5 blocks** by default (a circuit-breaker on top of Polygon's ~5s deterministic finality), so release eligibility arrives after a few transactions on their own.

If you deployed with a higher depth (`REQUIRED_CONFIRMATIONS` env var), mine blocks manually:

```bash
npm run mine:128
```

That command satisfies any configured depth.

### Step 10: Submit Oracle Verification

After creating, the app opens the escrow workspace automatically (or click the escrow's row — the first on-chain escrow is `#0` — in the **Escrows** table).

Click:

```text
Refresh oracle feed
Submit verification
```

Expected behavior:

```text
Backend signs oracle verification using ORACLE_PRIVATE_KEY.
Contract sees all five checks are true.
Funds release to exporter.
Contract emits e-BL transfer event to importer.
```

## 5. Demo Script You Can Say

Use this short narration:

```text
STERN Protocol replaces slow Letter of Credit and Bill of Lading settlement with smart escrow.
The importer locks funds into the smart contract.
The e-BL is represented by an IPFS CID.
The oracle gateway checks five conditions: VGM, AIS departure, CEISA customs approval,
e-BL CID validity, and the pre-shipment inspection certificate.
After all five checks are attested, funds release in seconds — Polygon has had
~5-second deterministic finality since Heimdall v2, and the contract adds a
configurable confirmation depth as a circuit-breaker for finality-lag incidents
like September 2025 — instead of two to four weeks of bank document checking.
The system is trust-minimized: inspectors and customs still attest, but once they sign,
settlement is instant and unarguable. We do not compete with the surveyor —
we compete with the paper-shuffling that happens after the surveyor already said yes.
If there is a mismatch, funds stay locked, and importer, exporter, and the inspection
body resolve the dispute through 2-of-3 voting.
If the vessel is delayed, both parties can sign a deadline amendment instead of
cancelling the contract.
```

## 6. Common Demo Problems

### MetaMask Shows Wrong Network

Switch to:

```text
Hardhat Local
Chain ID 31337
```

### Backend Says Missing Env

Check `.env`:

```text
RPC_URL must be set
CONTRACT_ADDRESS must be set
ORACLE_PRIVATE_KEY must be set
```

### Submit Oracle Fails

Most likely causes:

```text
1. ORACLE_PRIVATE_KEY is not the trusted oracle account.
2. Hardhat node was restarted after deployment.
3. CONTRACT_ADDRESS is from an old node session.
4. Escrow ID does not exist.
5. The deployed contract is from before the 5-check upgrade
   (submitVerification now takes five booleans) — redeploy with
   npm run compile + npm run deploy:local and update both .env files.
```

Fix:

```text
Restart Hardhat node.
Deploy again.
Update .env and frontend/.env.
In MetaMask: Settings -> Advanced -> Clear activity tab data
(fixes stale-nonce "transaction failed" errors after a node restart).
Restart backend and frontend.
Create escrow again.
Submit oracle again.
```

### MetaMask Does Not Ask To Confirm

MetaMask should open only after you click:

```text
Create escrow
```

on the **Create** screen.

If MetaMask does not open, check these items:

```text
1. You are using a normal browser with MetaMask installed.
   The Codex in-app browser does not have your MetaMask extension.

2. frontend/.env exists and has:
   VITE_CONTRACT_ADDRESS=your_deployed_contract_address
   VITE_ORACLE_API=http://localhost:4000

3. You restarted the frontend after creating frontend/.env.

4. MetaMask is connected to:
   Hardhat Local
   http://127.0.0.1:8545
   Chain ID 31337

5. Your connected MetaMask account is Hardhat Account #0.

6. You already attached the e-BL file before Lock funds in escrow.

7. Exporter wallet and arbiter wallet are valid addresses.
```

If `VITE_CONTRACT_ADDRESS` is missing, the frontend uses mock mode and shows:

```text
Escrow created: mock-transaction
```

That means no on-chain transaction was sent, so MetaMask will not ask for confirmation.

### Which Account Is The Importer?

The importer is the connected MetaMask account, because the Solidity contract uses:

```text
msg.sender
```

So yes, for the demo your importer should be Hardhat Account #0 if that is the account imported into MetaMask.

The **Importer wallet** field in the UI is currently informational for the demo. The real on-chain importer is the wallet that clicks **Create escrow** and signs the transaction.

### Do I Need Real Money?

No.

Use local Hardhat ETH only. It is dummy ETH for testing and has no real value.
