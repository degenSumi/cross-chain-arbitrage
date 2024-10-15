# cross-chain-arbitrage

This implements a cross-chain arbitrage bot designed to identify and execute profitable trading opportunities across different pools on blockchain networks(Solana/Sui).

## Overview

The Cross-Chain Arbitrage bot monitors price discrepancies of assets(SOL/USDC) across Solana and Sui networks. When a profitable arbitrage opportunity is identified, the bot automatically executes trades to capitalize on the price difference.

Supported Dexs:
Orca: Solana
RaydiumV4: Solana
Cetus: Sui

USDC Prices are monitored on sol<>usdc pool (any other pair can be configured) as they update on both the networks, when there is a significant difference in the prices and an opportunity is found:
to capture usdc value, we can swap our usdc on source chain to sol and then bridge it to destination chain and convert back to USDC on the chain to get more USDC than deployed, however we can skip the native swaping on source chain and send the SOL to destination chain and get the required USDC from it, native swaping is not part of implementation yet as it focuses on cross chain part, however the cost for native swapping have been taken into account.
When a profitable case is found, after considering all costs invloved: *bridging cost, network gas etc* the bot bridges the assets using wormhole.

It than recursively checks the pool state and bridges as long as there is a profit opportunity found.


## Prerequisites

- Node.js (v14 or higher)
- npm
- Access to Solana and Sui nodes
- Wallet with sufficient funds on supported networks

## Installation

1. Clone the repository:
   ```
   git clone https://github.com/degenSumi/cross-chain-arbitrage.git
   cd cross-chain-arbitrage
   ```

2. Install dependencies:
   ```
   npm install
   ```
   or if you're using yarn:
   ```
   yarn install
   ```

3. Configure environment variables:
   Copy the `.env.example` file to `.env` and fill in your specific configuration details.

## Usage

To start the arbitrage bot:

```
npm start
```

or with yarn:

```
yarn start
```

## Configuration

Edit the `config.json` file to adjust:

- Arbitrage thresholds
- Trading amount

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Disclaimer

This software is for educational purposes only. Use at your own risk. The authors are not responsible for any financial losses incurred through the use of this software.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.