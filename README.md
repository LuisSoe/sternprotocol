# STERN Protocol

STERN Protocol is a local MVP for blockchain-based smart escrow in export-import settlement. It replaces parts of the Letter of Credit and Bill of Lading workflow with a Solidity escrow contract, a trusted oracle gateway, deterministic logistics/customs mocks, and a React dashboard.

The MVP is intentionally local-first. VGM, AIS, CEISA, and IPFS are mocked so the core escrow flow can be tested without paid APIs or production credentials.

## Architecture

```text
Importer wallet
  -> locks funds in SternEscrow
  -> stores e-BL CID reference

Mock logistics/customs data
  -> VGM port IoT mock
  -> AIS departure mock
  -> CEISA customs approval mock
  -> IPFS CID validity mock

Oracle gateway
  -> aggregates mock data
  -> submits verification as trusted oracle

SternEscrow
  -> Pending -> Verified -> Completed
  -> Pending -> Refunded
  -> Pending/Verified -> Disputed -> Completed/Refunded
  -> releases funds to exporter after all checks and the configured confirmation depth
  -> emits e-BL transfer event to importer

React dashboard (sidebar workspace)
  -> escrow registry + portfolio stats
  -> validated escrow creation (e-BL file hashed locally into a CID)
  -> escrow workspace: lifecycle, five oracle checks + conformance harness,
     role-gated actions, dispute voting, deadline amendment, activity log
  -> actor session switcher (importer / exporter / arbiter) + oracle gateway status
```

## Folder Structure

```text
contracts/SternEscrow.sol
scripts/deploy.js
test/SternEscrow.test.js
backend/
  mock-apis/
  oracle-gateway/
frontend/
  src/
    components/
    lib/
    pages/
.env.example
hardhat.config.js
package.json
```

## Local Setup

Install root dependencies:

```bash
npm install
```

Install frontend dependencies:

```bash
cd frontend
npm install
```

Copy env example:

```bash
copy .env.example .env
```

## Smart Contract

Run tests:

```bash
npm test
```

Compile:

```bash
npm run compile
```

Run a local Hardhat node:

```bash
npx hardhat node
```

Deploy to local node in a second terminal:

```bash
npm run deploy:local
```

Set `CONTRACT_ADDRESS`, `RPC_URL`, and `ORACLE_PRIVATE_KEY` in `.env` using one of the local Hardhat private keys.

## Backend Oracle Gateway

Run:

```bash
npm run backend
```

Endpoints:

```text
GET  /health
GET  /mock-status/:contractId
POST /submit-oracle/:contractId
POST /open-dispute/:contractId
POST /resolve-dispute/:contractId
```

Required env vars for on-chain actions:

```text
RPC_URL
ORACLE_PRIVATE_KEY
CONTRACT_ADDRESS
```

If those are missing, the API returns a clear JSON error instead of crashing.

## Frontend

Run:

```bash
cd frontend
npm run dev
```

Build:

```bash
cd frontend
npm run build
```

Optional frontend env:

```text
VITE_CONTRACT_ADDRESS=deployed_contract_address
VITE_ORACLE_API=http://localhost:4000
```

Without wallet/env setup, the dashboard still supports the mock create and settlement demo state.

## Demo User Manual

Use this flow when presenting the MVP locally.

### Option A: Fast Demo Without Wallet

This shows the product UX and oracle mock logic without sending blockchain transactions.

1. Install dependencies:

```bash
npm install
cd frontend
npm install
```

2. Start the backend oracle gateway from the project root:

```bash
npm run backend
```

3. Start the frontend:

```bash
cd frontend
npm run dev
```

4. Open the frontend URL shown by Vite, usually:

```text
http://127.0.0.1:5173
```

5. The **Escrows** view shows portfolio stats and the escrow table (empty at first — no fake data).

6. Open **New escrow** (sidebar) and fill:

- exporter wallet (any valid address)
- arbiter wallet (must differ from the exporter)
- contract value
- commodity
- container reference
- deadline (at least 1 hour in the future)

Every field is validated inline.

7. Attach any real file as the **e-BL document**. The app hashes it locally with SHA-256 and shows the resulting content identifier (CID).

8. Click **Lock funds in escrow**. Without a wallet/contract address, the app creates local mock escrow state and opens the escrow workspace.

9. In the workspace, click **Refresh oracle feed**. The five checks move from *unchecked* to *attested*:

- VGM match
- Vessel departed (AIS)
- Customs approved (CEISA)
- e-BL hash valid
- Inspection passed (PSI surveyor)

10. Use the **conformance harness** toggles to flip any check to failure, refresh, and submit — funds stay locked. Switch actors via the session card at the bottom of the sidebar to walk the dispute (2-of-3 votes) and deadline-amendment flows.

This is enough for a UI/product demo.

### Option B: Full Local Blockchain Demo With Wallet

This sends real transactions to a local Hardhat chain using dummy local ETH. It does not use real money.

1. Start a local Hardhat node from the project root:

```bash
npx hardhat node
```

2. Copy one private key from the Hardhat node output. Use it only for local testing.

3. Add the local network to MetaMask or another browser wallet:

```text
Network name: Hardhat Local
RPC URL: http://127.0.0.1:8545
Chain ID: 31337
Currency symbol: ETH
```

4. Import one Hardhat test account into the wallet using its private key.

5. In another terminal, deploy the contract:

```bash
npm run deploy:local
```

6. Copy the deployed `SternEscrow` address into `.env`:

```text
CONTRACT_ADDRESS=deployed_contract_address
RPC_URL=http://127.0.0.1:8545
ORACLE_PRIVATE_KEY=hardhat_oracle_private_key
```

7. Create `frontend/.env`:

```text
VITE_CONTRACT_ADDRESS=deployed_contract_address
VITE_ORACLE_API=http://localhost:4000
```

8. Restart backend and frontend after editing env files:

```bash
npm run backend
```

```bash
cd frontend
npm run dev
```

9. Open the frontend and connect the imported Hardhat wallet.

10. Create an escrow. The contract value is paid in local dummy ETH from the imported Hardhat account.

11. (Usually unnecessary) The local deploy uses a confirmation depth of 5 blocks. If you deployed with a higher `REQUIRED_CONFIRMATIONS`, mine blocks:

```bash
npm run mine:128
```

12. Open the escrow from the **Escrows** table and click **Submit verification** in the workspace.

13. If all checks are true and the confirmation depth has passed, the contract releases funds to the exporter and emits the e-BL transfer event.

### Do You Need a Wallet?

For UI demo only: no wallet is required.

For full smart contract testing through the browser: yes, use MetaMask or another injected wallet with a local Hardhat account.

The MVP uses local Hardhat ETH as dummy value. It is not a custom ERC20 token and has no real-world value. Do not use a real mainnet wallet or real funds for this local demo.

## Mock APIs

The MVP uses deterministic mocks shaped like the real API responses ("we mock the credentials, not the architecture"):

- `vgm-mock.js`: container VGM, expected VGM, match status, gate-in status, Tanjung Priok port.
- `ais-mock.js`: vessel IMO and `departed` status.
- `ceisa-mock.js`: PEB number and `approved` customs status.
- `ipfs-mock.js`: CID validity check (the CID itself is a real SHA-256 hash of the file you attach in the UI).
- `inspection-mock.js`: PSI surveyor certificate (Sucofindo) and `passed` status.

Each mock is an adapter that a real integration can replace without changing the contract interface. Every check can be flipped per-request via query/body overrides — the UI's conformance-harness toggles use exactly that.

## Proposal PDF Check

The included proposal describes the same STERN concept: Polygon/Layer-2 smart escrow, e-BL CID on IPFS, VGM/AIS/CEISA verification, confirmation-depth finality safeguards, and 2-of-3 dispute governance. This implementation is aligned with the PDF and is stronger as an MVP because it includes a runnable Hardhat test suite, backend oracle gateway, deterministic mocks, and a buildable React dashboard.

## Validation

Current local validation:

```text
npx hardhat test: 13 passing
frontend npm run build: passed
```

## Deploying the Frontend to Vercel

The frontend is a static Vite build and deploys straight from GitHub:

1. In Vercel: **Add New Project** -> import this repository.
2. Set **Root Directory** to `frontend` (framework preset: Vite).
3. Add environment variables when you have a public deployment:

```text
VITE_CONTRACT_ADDRESS=your_amoy_contract_address
VITE_ORACLE_API=https://your-gateway-host
```

Without them, the deployed app runs in mock-session mode — which is a complete demo by itself.

The oracle gateway is a persistent Express server; host it on Render/Railway (build `npm install`, start `node backend/oracle-gateway/index.js`, plus the `RPC_URL` / `ORACLE_PRIVATE_KEY` / `CONTRACT_ADDRESS` env vars). The contract itself deploys to Polygon Amoy via `npx hardhat run scripts/deploy.js --network amoy` (requires `AMOY_RPC_URL` and `DEPLOYER_PRIVATE_KEY` in `.env`).

## Production Roadmap

- Deploy to Polygon Amoy testnet.
- Replace trusted backend oracle with Chainlink Functions and later multi-oracle consensus.
- Add real IPFS uploads through web3.storage or another storage provider.
- Integrate real CEISA/INSW and maritime AIS providers.
- Add ERC-4337 account abstraction for non-technical SME users.
- Add event indexing, notifications, and transaction history persistence.
- Run Slither, coverage, fuzzing, and an external smart contract audit before real-value pilots.
