# STERN Protocol Demo Fill Example

This file gives exact example values you can use when demoing the MVP.

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

## 2. Create Escrow Form Example

Open the **Create** screen and fill it like this.

```text
Importer wallet:
0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266

Exporter wallet:
0x70997970C51812dc3A010C7d01b50e0d17dc79C8

Arbiter wallet:
0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC

Contract value (ETH):
1

Commodity:
Indonesian Robusta Coffee

Container reference:
TGHU-2026-001

Deadline:
Pick any date/time at least 1 day in the future

File name:
electronic-bill-of-lading.pdf
```

Then click:

```text
Mock upload
```

You should see a generated CID like:

```text
bafybeisternelectronicbillofla
```

Then click:

```text
Create escrow
```

For simple UI demo, this creates local mock state in the frontend.

## 3. Settlement Screen Example

Open the **Settlement** screen.

Fill:

```text
Escrow ID:
0
```

Click:

```text
Refresh mock feed
```

Expected result:

```text
VGM checked: true
AIS departed: true
CEISA approved: true
e-BL CID valid: true
```

Then explain the settlement breakdown:

```text
Gross value: 1.000 ETH
Platform fee: 0.005 ETH
Gas fee placeholder: 0.002 ETH
Net to exporter: 0.993 ETH
```

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
ORACLE_PRIVATE_KEY=PASTE_HARDHAT_ACCOUNT_1_PRIVATE_KEY_HERE
PORT=4000
```

Important:

```text
ORACLE_PRIVATE_KEY must belong to the trusted oracle account printed during deploy.
```

By default, `scripts/deploy.js` uses Hardhat Account #1 as the trusted oracle.

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

Contract value (ETH):
1

Commodity:
Indonesian Robusta Coffee

Container reference:
TGHU-2026-001

Deadline:
Tomorrow or later

File name:
electronic-bill-of-lading.pdf
```

Click:

```text
Mock upload
Create escrow
```

MetaMask should ask you to confirm the transaction.

### Step 9: Mine 128 Blocks

From project root:

```bash
npm run mine:128
```

This satisfies the 128-block finality rule from the proposal.

### Step 10: Submit Oracle Verification

Open the **Settlement** screen.

Fill:

```text
Escrow ID:
0
```

Do not paste the transaction hash into this field. A transaction hash starts with `0x` and looks long, for example:

```text
0xb3379ac033c1dc8c104023b029adf8c22d14707454f1a5989fd3a0e54cc237d4
```

That is only the transaction receipt ID. The first escrow ID is:

```text
0
```

Click:

```text
Refresh mock feed
Submit oracle verification
```

Expected behavior:

```text
Backend signs oracle verification using ORACLE_PRIVATE_KEY.
Contract sees all checks are true.
Funds release to exporter.
Contract emits e-BL transfer event to importer.
```

## 5. Demo Script You Can Say

Use this short narration:

```text
STERN Protocol replaces slow Letter of Credit and Bill of Lading settlement with smart escrow.
The importer locks funds into the smart contract.  
The e-BL is represented by an IPFS CID.
The oracle gateway checks VGM, AIS departure, CEISA approval, and CID validity.
After all checks are true and 128 blocks pass, the contract releases funds to the exporter.
If there is mismatch, exporter, importer, and arbiter can resolve the dispute through 2-of-3 voting.
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
```

Fix:

```text
Restart Hardhat node.
Deploy again.
Update .env and frontend/.env.
Restart backend and frontend.
Create escrow again.
Mine 128 blocks.
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

6. You already clicked Mock upload before Create escrow.

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
