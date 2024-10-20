const BN = require('bn.js');
const { CetusClmmSDK, Percentage, TransactionUtil, adjustForSlippage, d , printTransaction } = require("@cetusprotocol/cetus-sui-clmm-sdk");
const { getFullnodeUrl } = require('@mysten/sui/client');
const { Ed25519Keypair } = require('@mysten/sui/keypairs/ed25519');
require('dotenv').config();

const SDKConfig = {
    clmmConfig: {
      pools_id: '0xf699e7f2276f5c9a75944b37a0c5b5d9ddfd2471bf6242483b03ab2887d198d0',
      global_config_id: '0xdaa46292632c3c4d8f31f23ea0f9b36a28ff3677e9684980e4438403a67a3d8f',
      global_vault_id: '0xce7bceef26d3ad1f6d9b6f13a953f053e6ed3ca77907516481ce99ae8e588f2b',
      admin_cap_id: '0x89c1a321291d15ddae5a086c9abc533dff697fde3d89e0ca836c41af73e36a75',
    },
    cetusConfig: {
      coin_list_id: '0x8cbc11d9e10140db3d230f50b4d30e9b721201c0083615441707ffec1ef77b23',
      launchpad_pools_id: '0x1098fac992eab3a0ab7acf15bb654fc1cf29b5a6142c4ef1058e6c408dd15115',
      clmm_pools_id: '0x15b6a27dd9ae03eb455aba03b39e29aad74abd3757b8e18c0755651b2ae5b71e',
      admin_cap_id: '0x39d78781750e193ce35c45ff32c6c0c3f2941fa3ddaf8595c90c555589ddb113',
      global_config_id: '0x0408fa4e4a4c03cc0de8f23d0c2bbfe8913d178713c9a271ed4080973fe42d8f',
      coin_list_handle: '0x49136005e90e28c4695419ed4194cc240603f1ea8eb84e62275eaff088a71063',
      launchpad_pools_handle: '0x5e194a8efcf653830daf85a85b52e3ae8f65dc39481d54b2382acda25068375c',
      clmm_pools_handle: '0x37f60eb2d9d227949b95da8fea810db3c32d1e1fa8ed87434fc51664f87d83cb',
    },
};

const clmmMainnet = {
    fullRpcUrl: getFullnodeUrl('mainnet'),
    simulationAccount: {
      address: '0x326ce9894f08dcaa337fa232641cc34db957aec9ff6614c1186bc9a7508df0bb',
    },
    cetus_config: {
      package_id: '0x95b8d278b876cae22206131fb9724f701c9444515813042f54f0a426c9a3bc2f',
      published_at: '0x95b8d278b876cae22206131fb9724f701c9444515813042f54f0a426c9a3bc2f',
      config: SDKConfig.cetusConfig,
    },
    clmm_pool: {
      package_id: '0x1eabed72c53feb3805120a081dc15963c204dc8d091542592abaf7a35689b2fb',
      published_at: '0x70968826ad1b4ba895753f634b0aea68d0672908ca1075a2abdf0fc9e0b2fc6a',
      config: SDKConfig.clmmConfig,
    },
    integrate: {
      package_id: '0x996c4d9480708fb8b92aa7acf819fb0497b5ec8e65ba06601cae2fb6db3312c3',
      published_at: '0x6f5e582ede61fe5395b50c4a449ec11479a54d7ff8e0158247adfda60d98970b',
    },
    deepbook: {
      package_id: '0x000000000000000000000000000000000000000000000000000000000000dee9',
      published_at: '0x000000000000000000000000000000000000000000000000000000000000dee9',
    },
    deepbook_endpoint_v2: {
      package_id: '0xac95e8a5e873cfa2544916c16fe1461b6a45542d9e65504c1794ae390b3345a7',
      published_at: '0xac95e8a5e873cfa2544916c16fe1461b6a45542d9e65504c1794ae390b3345a7',
    },
    aggregatorUrl: 'https://api-sui.cetus.zone/router',
    swapCountUrl: 'https://api-sui.cetus.zone/v2/sui/swap/count',
};

async function swapCetus(poolData){
    try {
        const sdk = new CetusClmmSDK(clmmMainnet);
        let sendKeypair = Ed25519Keypair.deriveKeypair(process.env.suimnemonic);
        let a2b = poolData.a2b;
        if(a2b)
          sdk.senderAddress =  "0xa27e93e635b9c68b422b72f01a34d6219ec6ed4c27fae5390d69de38fda641dd" // for testing otherwise use: 
        else
          sdk.senderAddress =  "0x52b2248a0105b42b050c9a6f6fc825cb6833e16192e482f8f6870683bcce58ba" // for testing otherwise use: 
        // sdk.senderAddress = sendKeypair.getPublicKey().toSuiAddress(); // use this for swapping
        const byAmountIn = true;
        const amount = poolData.amountIn || "100000";
        const slippage = Percentage.fromDecimal(d(0.1))

        const currentPool = await sdk.Pool.getPool('0x9ddb0d269d1049caf7c872846cc6d9152618d1d3ce994fae84c1c051ee23b179'); // SOL-USDC bridged
        // console.log('currentPool: ', currentPool)

        const decimalsA = 8
        const decimalsB = 6
        const res = await sdk.Swap.preswap({
            pool: currentPool,
            currentSqrtPrice: currentPool.current_sqrt_price,
            coinTypeA: currentPool.coinTypeA,
            coinTypeB: currentPool.coinTypeB,
            decimalsA,
            decimalsB,
            a2b,
            byAmountIn: byAmountIn,
            amount,
        })

        console.log('res', {
            estimatedAmountIn: res.estimatedAmountIn.toString(),
            estimatedAmountOut: res.estimatedAmountOut.toString(),
            estimatedEndSqrtprice: res.estimatedEndSqrtPrice.toString(),
            estimatedFeeAmount: res.estimatedFeeAmount.toString(),
            isExceed: res.isExceed,
            a2b,
            byAmountIn,
        })

        const toAmount = byAmountIn ? new BN(res.estimatedAmountOut) : new BN(res.estimatedAmountIn)

        const amountLimit = adjustForSlippage(toAmount, slippage, !byAmountIn)

        // let swapPayload = await sdk.Swap.createSwapTransactionPayload({
        //     pool_id: currentPool.poolAddress,
        //     a2b,
        //     by_amount_in: byAmountIn,
        //     amount: amount.toString(),
        //     amount_limit: amountLimit.toString(),
        //     coinTypeA: currentPool.coinTypeA,
        //     coinTypeB: currentPool.coinTypeB,
        // })
         // console.log(swapPayload)
        // printTransaction(swapPayload);
        // const simulate = await sdk.fullClient.devInspectTransactionBlock({transactionBlock:swapPayload, sender: sdk.senderAddress })


        let swapPayload = await sdk.Swap.createSwapTransactionWithoutTransferCoinsPayload({
            pool_id: currentPool.poolAddress,
            a2b,
            by_amount_in: byAmountIn,
            amount: amount.toString(),
            amount_limit: amountLimit.toString(),
            coinTypeA: currentPool.coinTypeA,
            coinTypeB: currentPool.coinTypeB,
        })

        TransactionUtil.buildTransferCoinToSender(sdk, swapPayload.tx, swapPayload.coinABs[0], currentPool.coinTypeA)
        TransactionUtil.buildTransferCoinToSender(sdk, swapPayload.tx, swapPayload.coinABs[1], currentPool.coinTypeB)


        // printTransaction(swapPayload.tx);
        const simulate = await sdk.fullClient.devInspectTransactionBlock({transactionBlock:swapPayload.tx, sender: sdk.senderAddress })
        // console.log(simulate.effects.gasUsed);
        // console.log((Number(simulate.effects.gasUsed.computationCost) + Number(simulate.effects.gasUsed.storageCost) - Number(simulate.effects.gasUsed.storageRebate)));
        
        if(!poolData.execute)
            return { swapOutAmount: res.estimatedAmountOut, txBuffer: swapPayload.tx, gasUsed: (Number(simulate.effects.gasUsed.computationCost) + Number(simulate.effects.gasUsed.storageCost) - Number(simulate.effects.gasUsed.storageRebate)) };
        const transferTxn = await sdk.fullClient.sendTransaction(sendKeypair, swapPayload.tx)
        console.log('swap: ', transferTxn);
        return transferTxn;
    } catch(error){
        console.log(error);
        return error;
    }
};

// swapCetus({
//     a2b: false,
//     amountIn: "158228357",
//     execute: false
// });

module.exports= {
    swapCetus
}

