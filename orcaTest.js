const { web3, AnchorProvider, Program, BN } = require("@project-serum/anchor");
const { TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction, createSyncNativeInstruction,
  createCloseAccountInstruction, NATIVE_MINT }
  = require("@solana/spl-token");
const { buildWhirlpoolClient, PDAUtil, swapQuoteByInputToken, WhirlpoolContext } = require("@orca-so/whirlpools-sdk");
const { deriveATA, Percentage } = require("@orca-so/common-sdk");
const { Transaction, SystemProgram, Keypair  } = require('@solana/web3.js');
const bs58 = require("bs58");
const idl = require("./artifacts/orca.json");
require('dotenv').config();

const solrpc = "https://api.devnet.solana.com";
const suirpc = process.env.suirpc;
const solprivatekey = process.env.solanaprivatekey;
const suiprivatekey = process.env.suimnemonic;

const connection = new web3.Connection(
    solrpc,
    "finalized"
);

async function swapOrca(connection, poolData){
    
    const { path, amountIn } = poolData;
    let { slippage } = poolData;

    slippage = new BN(Math.ceil(slippage));

    // Create Anchor provider
    const provider = new AnchorProvider(connection, {}, {});

    // Initialize the Program
    const programId = new web3.PublicKey(
      "whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc"
    );
    const program = new Program(idl, programId, provider);

    // Create the WhirpoolContext
    const context = WhirlpoolContext.withProvider(provider, programId);
    const client = buildWhirlpoolClient(context);

    const keypair =  Keypair.fromSecretKey(new Uint8Array(bs58.decode(process.env.solanaprivatekey)));

    const inputToken =  new web3.PublicKey(path[0]);
    const outputToken = new web3.PublicKey(path[1]);

    // Calculate Input amount
    const inputAmount = new BN(amountIn);

    // Set the slippage
    slippage = Percentage.fromFraction(slippage || 1, 100);

    const NEBULA_WHIRLPOOLS_CONFIG = new web3.PublicKey(
      "FcrweFY1G9HJAHG5inkGB6pKg1HZ6x9UC2WioAfWrGkR" // Nebula owning this and a lot of other pools
    );

    // tick spacing of the pool
    let tickSpacing = 64;
    
    const pool = PDAUtil.getWhirlpool(
        programId,
        NEBULA_WHIRLPOOLS_CONFIG,
        new web3.PublicKey(poolData.token_0 || "So11111111111111111111111111111111111111112"),
        new web3.PublicKey(poolData.token_1 || "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"),
        tickSpacing
    ).publicKey;


    const mainTx = new Transaction();

    // Derive ATA of the Tokens
    const [outputTokenATA, inputTokenATA] = await Promise.all([
      deriveATA(keypair.publicKey, outputToken),
      deriveATA(keypair.publicKey, inputToken)
    ]);

    const [accInfoFirst, accInfoSecond] = await Promise.all([
      provider.connection.getAccountInfo(inputTokenATA),
      provider.connection.getAccountInfo(outputTokenATA)
    ]);

    try {

      // Whirpool Object for Interacion
      const whirlpool = await client.getPool(pool);

      console.log(accInfoFirst, inputTokenATA);

      if (!accInfoFirst) {
        mainTx.add(
          createAssociatedTokenAccountInstruction(
            keypair.publicKey,
            inputTokenATA,
            keypair.publicKey,
            inputToken
          ),
          SystemProgram.transfer({
            fromPubkey: keypair.publicKey,
            toPubkey: inputTokenATA,
            lamports: 2000000,
          })
        );
        if (inputToken.toBase58() === NATIVE_MINT.toBase58()) {
          mainTx.add(
            createSyncNativeInstruction(
              inputTokenATA
            )
          );
        }
      }

      if (!accInfoSecond) {
        mainTx.add(
          createAssociatedTokenAccountInstruction(
            keypair.publicKey,
            outputTokenATA,
            keypair.publicKey,
            outputToken
          ),
          SystemProgram.transfer({
            fromPubkey: keypair.publicKey,
            toPubkey: outputTokenATA,
            lamports: 2000000,
          })
        );
        if (outputToken.toBase58() === NATIVE_MINT.toBase58()) {
          mainTx.add(
            createSyncNativeInstruction(
              outputTokenATA
            )
          );
        }
      }

      // Fetch token Details
      // const outputTokenATAAccount = await context.fetcher.getTokenInfo(outputTokenATA);
      // const inputTokenATAAccount = await context.fetcher.getTokenInfo(inputTokenATA);

      // get swap quote
      const quote = await swapQuoteByInputToken(
        whirlpool,
        inputToken,
        inputAmount,
        slippage,
        context.program.programId,
        context.fetcher,
        true
      );

    //   console.log(`amountIn: ${quote.estimatedAmountIn.toString()}
    //   amountOut: ${quote.estimatedAmountOut.toString()}
    //   amountOutImpact: ${quote.otherAmountThreshold.toString()}`);

      // get oracle for Orca
      const oracle = PDAUtil.getOracle(programId, whirlpool.getAddress()).publicKey;

      // Build the swap_transaction
      const swapTransaction = await program.methods
        .swap(
          quote.amount,
          quote.otherAmountThreshold,
          quote.sqrtPriceLimit,
          quote.amountSpecifiedIsInput,
          quote.aToB
        )
        .accounts({
          tokenProgram: TOKEN_PROGRAM_ID,
          tokenAuthority: keypair.publicKey,
          whirlpool: whirlpool.getAddress(),
          tokenVaultA: whirlpool.getData().tokenVaultA,
          tokenVaultB: whirlpool.getData().tokenVaultB,
          tokenOwnerAccountA: path[0] === (whirlpool.getData().tokenMintA).toBase58() ? inputTokenATA : outputTokenATA,
          tokenOwnerAccountB: path[0] === (whirlpool.getData().tokenMintA).toBase58() ? outputTokenATA : inputTokenATA,
          tickArray0: quote.tickArray0,
          tickArray1: quote.tickArray1,
          tickArray2: quote.tickArray2,
          oracle,
        })
        .instruction();

      mainTx.add(swapTransaction);


    // If you need SOL instead of wsol
    //   if (inputToken.mint.toBase58() === NATIVE_MINT.toBase58() && closeWSolAccount) {
    //     mainTx.add(createCloseAccountInstruction(
    //       // TOKEN_PROGRAM_ID,
    //       inputTokenATA,
    //       keypair,
    //       keypair
    //     ));
    //   }

    //   if (outputToken.mint.toBase58() === NATIVE_MINT.toBase58() && closeWSolAccount) {
    //     mainTx.add(createCloseAccountInstruction(
    //       // TOKEN_PROGRAM_ID,
    //       outputTokenATA,
    //       keypair,
    //       keypair
    //     ));
    //   }

      const tx = await web3.sendAndConfirmTransaction(connection, mainTx, [keypair]);

      console.log(tx);

    //   const { blockhash } = await connection.getLatestBlockhash('finalized');
    //   mainTx.recentBlockhash = blockhash;
    //   mainTx.feePayer = keypair.publicKey;

     

    //   const transactionBuffer = mainTx.serialize({
    //     requireAllSignatures: false,
    //     verifySignatures: false
    //   });

    //   const txBuffer =  Buffer.from(transactionBuffer).toString("base64");

    //   console.log(txBuffer);

      // Return the transaction
      return { swapOutAmount: quote.otherAmountThreshold, txBuffer: mainTx};

    } catch (error) {
      console.log(error)
      return error;
    }
};

swapOrca(connection, {
    path: ["BRjpCHtyQLNCo8gqRUr8jtdAj5AjPYQaoqbvcZiHok1k","So11111111111111111111111111111111111111112", ],
    amountIn: "15000",
    pool_address: "Czfq3xZZDmsdGdUyrNLtRhGc47cXcZtLG4crryfu44zE",
    token_0: "So11111111111111111111111111111111111111112",
    token_0_decimals: 9,
    token_1: "BRjpCHtyQLNCo8gqRUr8jtdAj5AjPYQaoqbvcZiHok1k",
    token_1_decimals: 6,
    token_vault_a: "EUuUbDcafPrmVTD5M6qoJAoyyNbihBhugADAxRMn5he9", // for calculating price impact and slippage
    token_vault_b: "2WLWEuKDgkDUccTpbwYp1GToYktiSB1cXvreHUwiSUVP"
});
