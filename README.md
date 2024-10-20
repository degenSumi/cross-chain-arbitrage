# Cross-Chain Arbitrage

This project implements a cross-chain arbitrage bot designed to identify and execute profitable trading opportunities across different pools on Solana and Sui Network

## Overview

The Cross-Chain Arbitrage bot monitors price discrepancies of assets (SOL/USDC) across the Solana and Sui networks. When a profitable arbitrage opportunity is identified, the bot automatically executes trades to capitalize on the price difference.

### Supported DEXs
- **Orca**
- **RaydiumV4**
- **Cetus**

### How it Works

USDC prices are monitored in the SOL/USDC pool (other pairs can be configured). When there is a significant price difference across networks, the bot captures arbitrage opportunities as follows:

1. **Price Monitoring**: Prices are tracked on both networks.
2. **Swap and Bridge**: Upon detecting an opportunity, the bot can:
   - Swap USDC for SOL on the source chain.
   - Bridge SOL to the destination chain.
   - Convert SOL back to USDC to generate more profit than initially deployed.
   
   Native swapping on the source chain can be skipped, and SOL can be sent directly to the destination chain to swap for USDC. While native swapping is not yet implemented, the cost of swapping is taken into account.
   
3. **Cost Consideration**: The bot factors in bridging costs, network gas fees, and other expenses before executing trades.
   
4. **Recursive Execution**: If a profit is still available after the first trade, the bot continues to bridge and trade as it monitors all the pools in realtime.

### Technologies
- **Wormhole Bridge**: Used for bridging assets between Solana and Sui.

![image](https://github.com/user-attachments/assets/86b5ad88-4927-479c-94e9-a57532ba2e0d)

---

## Prerequisites

- **Node.js** (v14 or higher)
- **npm**
- Access to **Solana** and **Sui** rpc nodes

---

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/degenSumi/cross-chain-arbitrage.git
   cd cross-chain-arbitrage
   ```

2. Install dependencies:
   ```bash
   npm install
   ```
   Or, if you're using yarn:
   ```bash
   yarn install
   ```

3. Configure environment variables:
   - Copy the `.env.example` file to `.env`.
   - Fill in your specific configuration details (API keys, network settings, etc.).
   - Add threshold and swapamount in `config.json`

---

## Usage

To start the arbitrage bot, run:

```bash
npm start
```

Or with yarn:

```bash
yarn start
```

---

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

---

## Disclaimer

This software is for **educational purposes only**. Use at your own risk. The authors are not responsible for any financial losses incurred through the use of this software.

---
