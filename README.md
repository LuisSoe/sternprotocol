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
  -> releases funds to exporter after all checks and 128 blocks
  -> emits e-BL transfer event to importer

React dashboard
  -> dashboard metrics
  -> create escrow flow
  -> settlement and dispute controls
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

5. Go to **Dashboard** and show:

- active escrow balance
- active contract count
- settled value
- VGM, AIS, CEISA, and e-BL status rails

6. Go to **Create** and fill:

- exporter wallet
- arbiter wallet
- contract value
- commodity
- container reference
- deadline
- e-BL file name

7. Click **Mock upload**. The app generates a fake IPFS CID.

8. Click **Create escrow**. Without a wallet contract address, the app creates a local mock escrow state for the demo.

9. Go to **Settlement**.

10. Click **Refresh mock feed**. The dashboard calls the backend mock oracle and shows:

- VGM checked
- AIS departed
- CEISA approved
- e-BL CID valid

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

11. Mine 128 blocks before release eligibility:

```bash
npm run mine:128
```

12. In the Settlement screen, click **Submit oracle verification**.

13. If all checks are true and 128 blocks have passed, the contract releases funds to the exporter and emits the e-BL transfer event.

### Do You Need a Wallet?

For UI demo only: no wallet is required.

For full smart contract testing through the browser: yes, use MetaMask or another injected wallet with a local Hardhat account.

The MVP uses local Hardhat ETH as dummy value. It is not a custom ERC20 token and has no real-world value. Do not use a real mainnet wallet or real funds for this local demo.

## Mock APIs

The MVP uses deterministic mocks:

- `vgm-mock.js`: container VGM, expected VGM, match status, gate-in status, Tanjung Priok port.
- `ais-mock.js`: vessel IMO and `departed` status.
- `ceisa-mock.js`: PEB number and `approved` customs status.
- `ipfs-mock.js`: mock upload and CID validity.

These are structured so real integrations can replace them later without changing the contract interface.

## Proposal PDF Check

The included proposal describes the same STERN concept: Polygon/Layer-2 smart escrow, e-BL CID on IPFS, VGM/AIS/CEISA verification, 128-block finality, and 2-of-3 dispute governance. This implementation is aligned with the PDF and is stronger as an MVP because it includes a runnable Hardhat test suite, backend oracle gateway, deterministic mocks, and a buildable React dashboard.

## Validation

Current local validation:

```text
npx hardhat test: 7 passing
frontend npm run build: passed
```

## Production Roadmap

- Deploy to Polygon Amoy testnet.
- Replace trusted backend oracle with Chainlink Functions and later multi-oracle consensus.
- Add real IPFS uploads through web3.storage or another storage provider.
- Integrate real CEISA/INSW and maritime AIS providers.
- Add ERC-4337 account abstraction for non-technical SME users.
- Add event indexing, notifications, and transaction history persistence.
- Run Slither, coverage, fuzzing, and an external smart contract audit before real-value pilots.
