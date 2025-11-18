const { Connection, PublicKey } = require("@solana/web3.js");
const { EventEmitter } = require("events");
const { SuiClient } = require("@mysten/sui/client");
const {
  LIQUIDITY_STATE_LAYOUT_V4,
  MAINNET_PROGRAM_ID,
} = require("@raydium-io/raydium-sdk");
const bs58 = require("bs58");

class Listener extends EventEmitter {
  connection;
  constructor(connection) {
    super();
    this.connection = connection;
  }
  // Listening to a single orca pool
  async subscribeToOrcaSinglePool(sol_pool) {
    return this.connection.onAccountChange(
      new PublicKey(sol_pool.pool_address),
      async (updatedAccountInfo) => {
        try {
          const current_sqrt_price =
            updatedAccountInfo.data.readBigUInt64LE(65);
          const currentPrice =
            Math.pow(Number(current_sqrt_price) / Math.pow(2, 64), 2) *
            Math.pow(10, sol_pool.token_0_decimals - sol_pool.token_1_decimals);
          // to-do getting the actual reserves for the price impact calc, doing later on
          // console.log('stateprice', currentPrice);
          const reserve_0 = (
            await this.connection.getTokenAccountBalance(
              new PublicKey(updatedAccountInfo.data.slice(133, 165))
            )
          ).value.amount;
          const reserve_1 = (
            await this.connection.getTokenAccountBalance(
              new PublicKey(updatedAccountInfo.data.slice(213, 245))
            )
          ).value.amount;
          this.emit("solpool", {
            currentPriceOnSol: currentPrice,
            reserve_0,
            reserve_1,
            sqrtPriceX96: current_sqrt_price,
            liquidity: updatedAccountInfo.data.readBigUInt64LE(49),
            pool_address: sol_pool.pool_address,
          });
        } catch (error) {
          console.log(error);
        }
      },
      {
        commitment: this.connection.commitment,
      }
    );
  }
  // polling sui pool change
  async pollSuiPoolChanges(sui_pool) {
    // as event listening is depreceated on sui, fallback to polling
    const client = new SuiClient({
      url: "https://fullnode.mainnet.sui.io:443",
    });
    try {
      const poll = async () => {
        try {
          const result = await client.getObject({
            options: { showContent: true, showDisplay: true },
            id: sui_pool.pool_address,
          });
          const nativeprice = await client.getObject({
            options: { showContent: true, showDisplay: true },
            id: "0xb8d7d9e66a60c239e7a60110efcf8de6c705580ed924d0dde141f4a0e2c90105",
          });

          const { current_sqrt_price, coin_a, coin_b, liquidity } =
            result.data.content.fields;
          const currentPrice =
            Math.pow(Number(current_sqrt_price) / Math.pow(2, 64), 2) *
            Math.pow(10, sui_pool.token_0_decimals - sui_pool.token_1_decimals);
          // console.log("current Price: ", currentPrice, coin_a, coin_b);
          const nativePool = nativeprice.data.content.fields;
          let suiUsdc =
            Math.pow(
              Number(nativePool.current_sqrt_price) / Math.pow(2, 64),
              2
            ) * Math.pow(10, 6 - 9);
          this.emit("suipool", {
            currentPriceOnSui: currentPrice,
            reserve_0: coin_a,
            reserve_1: coin_b,
            pool_address: sui_pool.pool_address,
            liquidity,
            suiNativePrice: suiUsdc,
          });
        } catch (error) {
          // console.error('Error fetching object state:', error);
        }
      };
      // Poll every 1 second
      setInterval(poll, 10000);
    } catch (error) {
      console.error("Error setting up polling:", error);
    }
  }
  // Listening to any sol-usdc raydium pool
  async subscribeToRaydiumPools() {
    return this.connection.onProgramAccountChange(
      MAINNET_PROGRAM_ID.AmmV4,
      async (updatedAccountInfo) => {
        try {
          const poolState = LIQUIDITY_STATE_LAYOUT_V4.decode(
            updatedAccountInfo.accountInfo.data
          );
          // console.log('pool', poolState, updatedAccountInfo);
          const reserve_0 = (
            await this.connection.getTokenAccountBalance(poolState.baseVault)
          ).value.amount;
          const reserve_1 = (
            await this.connection.getTokenAccountBalance(poolState.quoteVault)
          ).value.amount;

          const stateprice =
            reserve_1 /
            10 ** poolState.quoteDecimal /
            (reserve_0 / 10 ** poolState.baseDecimal);
          this.emit("solpool", {
            currentPriceOnSol: stateprice,
            reserve_0,
            reserve_1,
            pool_address: updatedAccountInfo.accountId.toBase58(),
          });
        } catch (error) {
          console.log(error);
        }
      },
      this.connection.commitment,
      [
        { dataSize: LIQUIDITY_STATE_LAYOUT_V4.span },
        {
          memcmp: {
            offset: LIQUIDITY_STATE_LAYOUT_V4.offsetOf("quoteMint"),
            bytes: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
          },
        },
        {
          memcmp: {
            offset: LIQUIDITY_STATE_LAYOUT_V4.offsetOf("baseMint"),
            bytes: "So11111111111111111111111111111111111111112",
          },
        },
        {
          memcmp: {
            offset: LIQUIDITY_STATE_LAYOUT_V4.offsetOf("marketProgramId"),
            bytes: MAINNET_PROGRAM_ID.OPENBOOK_MARKET.toBase58(),
          },
        },
        {
          memcmp: {
            offset: LIQUIDITY_STATE_LAYOUT_V4.offsetOf("status"),
            bytes: bs58.encode([6, 0, 0, 0, 0, 0, 0, 0]),
          },
        },
      ]
    );
  }
  // Listening to any orca sol-usdc pool
  async subscribeToOrcaPools(sol_pool) {
    return this.connection.onProgramAccountChange(
      new PublicKey("whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc"),
      async (updatedAccountInfo) => {
        try {
          const current_sqrt_price =
            updatedAccountInfo.accountInfo.data.readBigUInt64LE(65);
          const currentPrice =
            Math.pow(Number(current_sqrt_price) / Math.pow(2, 64), 2) *
            Math.pow(10, sol_pool.token_0_decimals - sol_pool.token_1_decimals);
          // to-do getting the actual reserves for the price impact calc, doing later on
          // console.log('stateprice', currentPrice);
          const reserve =
            updatedAccountInfo.accountInfo.data.readBigUInt64LE(65);
          const reserve_0 = (
            await this.connection.getTokenAccountBalance(
              new PublicKey(updatedAccountInfo.accountInfo.data.slice(133, 165))
            )
          ).value.amount;
          const reserve_1 = (
            await this.connection.getTokenAccountBalance(
              new PublicKey(updatedAccountInfo.accountInfo.data.slice(213, 245))
            )
          ).value.amount;
          this.emit("solpool", {
            currentPriceOnSol: currentPrice,
            reserve_0,
            reserve_1,
            sqrtPriceX96: current_sqrt_price,
            pool_address: updatedAccountInfo.accountId.toBase58(),
          });
        } catch (error) {
          console.log(error);
        }
      },
      this.connection.commitment,
      [
        { dataSize: 653 },
        {
          memcmp: {
            offset: 181,
            bytes: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
          },
        },
        {
          memcmp: {
            offset: 101,
            bytes: "So11111111111111111111111111111111111111112",
          },
        },
      ]
    );
  }
}

// let listener = new Listener(connection);
// listener.subscribeToOrcaSinglePool(sol_pool);
// listener.pollSuiPoolChanges(sui_pool);
// listener.subscribeToOrcaPools(sol_pool);
// listener.subscribeToRaydiumPools();

// listener.on('solpool', console.log);
// listener.on('suipool', console.log);

module.exports = {
  Listener,
};
