# STERN Protocol - Agent Rules

## Always Use Context7 For
- Solidity, Hardhat, Ethers.js, and blockchain library code.
- Chainlink oracle integration.
- Polygon network configuration.
- Any library/API documentation, setup, or configuration steps.

## Use Sequential Thinking For
- Escrow state machine design decisions.
- Oracle consensus logic.
- Settlement flow design.
- Security, reentrancy, and failure-mode analysis.

## Use Firecrawl For
- Chainlink docs: https://docs.chain.link
- Polygon docs: https://docs.polygon.technology
- Hardhat docs: https://hardhat.org/docs
- External API documentation that needs crawling or Markdown extraction.

## Use Perplexity For
- Cited research.
- Competitor analysis.
- Regulatory and compliance research.
- AIS, CEISA, NLE, customs, and logistics provider discovery.

## Use Playwright For
- Live dApp UI validation.
- Browser flow testing.
- Screenshots of escrow, oracle, and settlement screens.

## Stack
- Solidity 0.8.20
- Hardhat
- Polygon Mumbai or current Polygon testnet equivalent
- Chainlink
- IPFS/web3.storage
- Node.js
- React + Ethers.js

## Development Rules
- Use mock data only in development.
- Do not make real external API calls unless explicitly approved.
- Never commit API keys, private keys, mnemonics, or bearer tokens.
