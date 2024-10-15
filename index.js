const { Connection } = require('@solana/web3.js');
const { Listener } = require("./listeners");
const { startbridge } = require("./wormwhole");
const chalk = require("chalk");
const config = require("./config.json");
const dotenv =  require('dotenv');
const fs = require('fs');
const path = require('path');
dotenv.config();

const jsonFilePath = path.join(__dirname, 'backtest.json');

// To backtest the startegy
async function bactestData(arbValueUSDC) {
    const timestamp = new Date().toISOString();

    // Appending data
    let data = [];
    try {
        const fileContent = await fs.promises.readFile(jsonFilePath, 'utf-8');
        data = JSON.parse(fileContent);
    } catch (error) {
        console.error("Could not read the JSON file:", error);
    }

    data.push({ timestamp, arbValueUSDC });

    try {
        await fs.promises.writeFile(jsonFilePath, JSON.stringify(data, null, 2));
        console.log("data added to backtest");
    } catch (error) {
        console.error("Could not write to the JSON file:", error);
    }
};

// sol-usdc orca pool to perform arbitrage on, additionally we can also use all pools of sol-usdc on orca/raydium
const sol_pool = {
    pool_address: "Czfq3xZZDmsdGdUyrNLtRhGc47cXcZtLG4crryfu44zE",
    token_0: "So11111111111111111111111111111111111111112",
    token_0_decimals: 9,
    token_1: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    token_1_decimals: 6,
    token_vault_a: "EUuUbDcafPrmVTD5M6qoJAoyyNbihBhugADAxRMn5he9", // for calculating price impact and slippage
    token_vault_b: "2WLWEuKDgkDUccTpbwYp1GToYktiSB1cXvreHUwiSUVP"
};

// cetus pool of wsol-usdc(bridged)
const sui_pool = {
    pool_address: "0x9ddb0d269d1049caf7c872846cc6d9152618d1d3ce994fae84c1c051ee23b179",
    token_0: "0xb7844e289a8410e50fb3ca48d69eb9cf29e27d223ef90353fe1bd8e27ff8f3f8::coin::COIN",
    token_0_decimals: 8,
    token_1: "0x5d4b302506645c37ff133b98c4b50a5ae14841659738d6d733d59d0d217a93bf::coin::COIN",
    token_1_decimals: 6
};

// template poolstate
const poolInfoSol = {
        currentPriceOnSol: 152.93974777457757, // data to init
        reserve_0: '47715571943011',
        reserve_1: '10180367733395',
        pool_address: 'Czfq3xZZDmsdGdUyrNLtRhGc47cXcZtLG4crryfu44zE',
        liquidity: 2788550365743
};

const poolInfoSui = {
        currentPriceOnSui: 165.13154389151228,  // data to init
        reserve_0: '96830187409',
        reserve_1: '339591147420',
        pool_address: '0x9ddb0d269d1049caf7c872846cc6d9152618d1d3ce994fae84c1c051ee23b179',
        liquidity: 2788550365743,
};

const solrpc = process.env.solanarpc;
const suirpc = process.env.suirpc;
const solprivatekey = process.env.solanaprivatekey;
const suiprivatekey = process.env.suimnemonic;

const connection = new Connection(
    solrpc,
    "finalized"
);

async function runbot(){

    const listener = new Listener(connection);
    
    // Listening to any of the dexes clmm: orca,cetus amm: raydium v4
    listener.subscribeToOrcaSinglePool(sol_pool);
    listener.pollSuiPoolChanges(sui_pool);

    // We can also use all the pools by listening using the methods: subscribeToOrcaPools subscribeToRaydiumPools of Listener, for the assesment using only single orca pool
    
    listener.on("solpool", async (poolinfo) => {
        Object.assign(poolInfoSol, poolinfo);
        const pricediff = poolInfoSol.currentPriceOnSol - poolInfoSui.currentPriceOnSui;
        switch (true) {
            case Math.abs(pricediff) >= config.threshold && pricediff < 0:
                // Case when we can bridge from solana to sui
                try {
                    // Get bridge quote
                    const bridgequote = await startbridge({
                        sendChain: "Solana",
                        rcvChain: "Sui",
                        amount: config.swapamount,
                        solprivatekey,
                        suiprivatekey
                    });
    
                    // Calculate output and costs
                    const outAmount = Number(bridgequote.destinationToken.amount);
                    const outAmountInUsdc = (outAmount / 10 ** sui_pool.token_0_decimals) * Number(poolInfoSui.currentPriceOnSui); // Sus slippage
                    const networkCost = Number(5000) + Number(bridgequote.relayFee.amount);
                    const networkCostInUsdc = (networkCost / 10 ** 9) * Number(poolInfoSol.currentPriceOnSol);

                    // Get the impact price clmm
                    // const priceImpact = (outAmount / Number(poolInfoSui.liquidity)) * Number(poolInfoSui.currentPriceOnSui); // Price change due to the swap
                    // const newPrice = Number(poolInfoSui.currentPriceOnSui) + priceImpact * 0.001; // New price after the swap
                    // const outAmountInUsdcImpact = (outAmount / 10 ** Number(sui_pool.token_0_decimals)) * Number(newPrice);
    
                    // Calculate arbitrage value
                    const swapvalueInUsdc = poolInfoSol.currentPriceOnSol * config.swapamount;
                    const cost = swapvalueInUsdc + networkCostInUsdc; // Ignoring the impact price for now
                    const arbValueUSDC = outAmountInUsdc - cost;
    
                    if (arbValueUSDC <= 0) {
                        console.log(chalk.red(`🚨 Arbitrage Opportunity Detected! 
                        - Estimated Loss: **${arbValueUSDC.toFixed(3)} USDC**
                        - Trade Amount: **${config.swapamount.toFixed(2)} SOL**`));
                        // await bactestData(arbValueUSDC);
                    } else {
                        console.log(chalk.green(`🚀 Arbitrage Opportunity Detected! 
                        - Estimated Profit: **${arbValueUSDC.toFixed(3)} USDC**
                        - Trade Amount: **${config.swapamount.toFixed(2)} SOL**`));
                        // await bactestData(arbValueUSDC);
                    }
    
                    // Execute the bridge and swap if arbitrage is profitable
                    // if (arbValueUSDC > 0.01) {
                    //     await startbridge({
                    //         sendChain: "Solana",
                    //         rcvChain: "Sui",
                    //         amount: config.swapamount,
                    //         solprivatekey,
                    //         suiprivatekey,
                    //         execute: true
                    //     });
                    // }
                } catch (error) {
                    console.error("Error during bridge operation:", error);
                }
                break;
            case Math.abs(pricediff) >= config.threshold && pricediff > 0:
                try {
                    // Get bridge quote
                    const bridgequote = await startbridge({
                        sendChain: "Sui",
                        rcvChain: "Solana",
                        amount: config.swapamount,
                        solprivatekey,
                        suiprivatekey
                    });
    
                    // Calculate output and costs
                    const outAmount = Number(bridgequote.destinationToken.amount);
                    const outAmountInUsdc = (outAmount / 10 ** sol_pool.token_0_decimals) * Number(poolInfoSol.currentPriceOnSol);
                    const networkCost = Number(5000) + Number(bridgequote.relayFee.amount);
                    const networkCostInUsdc = (networkCost / 10 ** 8) * Number(poolInfoSui.currentPriceOnSui);
    
                    // Get the impact price clmm
                    // const priceImpact = (outAmount / Number(poolInfoSol.liquidity)) * Number(poolInfoSol.currentPriceOnSol); // Price change due to the swap
                    // const newPrice = Number(poolInfoSol.currentPriceOnSol) + priceImpact * 0.1; // New price after the swap
                    // const outAmountInUsdcImpact = (outAmount / 10 ** Number(sol_pool.token_0_decimals)) * Number(newPrice);
    

                    // Calculate arbitrage value
                    const swapvalueInUsdc = poolInfoSui.currentPriceOnSui * config.swapamount;
                    const cost = swapvalueInUsdc + networkCostInUsdc;
                    const arbValueUSDC = outAmountInUsdc - cost;
    
                    if (arbValueUSDC <= 0) {
                        console.log(chalk.red(`🚨 Arbitrage Opportunity Detected! 
                        - Estimated Loss: **${arbValueUSDC.toFixed(3)} USDC**
                        - Trade Amount: **${config.swapamount.toFixed(2)} SOL**`));
                        // await bactestData(arbValueUSDC);
                    } else {
                        console.log(chalk.green(`🚀 Arbitrage Opportunity Detected! 
                        - Estimated Profit: **${arbValueUSDC.toFixed(3)} USDC**
                        - Trade Amount: **${config.swapamount.toFixed(2)} SOL**`));
                        // await bactestData(arbValueUSDC);
                    }       
                    // Execute the bridge if arbitrage is profitable
                    // Additionally swap the wsol to usdc on the destination chain, trade execution for local swap not part of the bot yet
                    // if (arbValueUSDC > 0.1) {
                    //     await startbridge({
                    //         sendChain: "Sui",
                    //         rcvChain: "Solana",
                    //         amount: config.swapamount,
                    //         solprivatekey,
                    //         suiprivatekey,
                    //         execute: true // for excuting the bridge
                    //     });
                    // }
                } catch (error) {
                    console.error("Error during bridge operation:", error);
                }
                break;
        }
    });

    listener.on("suipool", async (poolinfo) => {
        Object.assign(poolInfoSui, poolinfo);
        // same logic can be used here with slight modifications
    });

};

runbot();