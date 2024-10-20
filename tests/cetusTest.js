const BN = require('bn.js');
const { CetusClmmSDK, Percentage, TransactionUtil, adjustForSlippage, d , printTransaction } = require("@cetusprotocol/cetus-sui-clmm-sdk");
const { getFullnodeUrl, s } = require('@mysten/sui/client');
const { Ed25519Keypair } = require('@mysten/sui/keypairs/ed25519');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const SDKConfig = {
    clmmConfig: {
      pools_id: '0xc090b101978bd6370def2666b7a31d7d07704f84e833e108a969eda86150e8cf',
      global_config_id: '0x6f4149091a5aea0e818e7243a13adcfb403842d670b9a2089de058512620687a',
      global_vault_id: '0xf3114a74d54cbe56b3e68f9306661c043ede8c6615f0351b0c3a93ce895e1699',
      admin_cap_id: '0xa456f86a53fc31e1243f065738ff1fc93f5a62cc080ff894a0fb3747556a799b',
    },
    cetusConfig: {
      coin_list_id: '0x257eb2ba592a5480bba0a97d05338fab17cc3283f8df6998a0e12e4ab9b84478',
      launchpad_pools_id: '0xdc3a7bd66a6dcff73c77c866e87d73826e446e9171f34e1c1b656377314f94da',
      clmm_pools_id: '0x26c85500f5dd2983bf35123918a144de24e18936d0b234ef2b49fbb2d3d6307d',
      admin_cap_id: '0x1a496f6c67668eb2c27c99e07e1d61754715c1acf86dac45020c886ac601edb8',
      global_config_id: '0xe1f3db327e75f7ec30585fa52241edf66f7e359ef550b533f89aa1528dd1be52',
      coin_list_handle: '0x3204350fc603609c91675e07b8f9ac0999b9607d83845086321fca7f469de235',
      launchpad_pools_handle: '0xae67ff87c34aceea4d28107f9c6c62e297a111e9f8e70b9abbc2f4c9f5ec20fd',
      clmm_pools_handle: '0xd28736923703342b4752f5ed8c2f2a5c0cb2336c30e1fed42b387234ce8408ec',
    },
  }
  
const clmmTestnet = {
    fullRpcUrl: 'https://sui-testnet-endpoint.blockvision.org',
    simulationAccount: {
      address: '0xcd0247d0b67e53dde69b285e7a748e3dc390e8a5244eb9dd9c5c53d95e4cf0aa',
    },
    faucet: {
      package_id: '0x26b3bc67befc214058ca78ea9a2690298d731a2d4309485ec3d40198063c4abc',
      published_at: '0x26b3bc67befc214058ca78ea9a2690298d731a2d4309485ec3d40198063c4abc',
    },
    cetus_config: {
      package_id: '0xf5ff7d5ba73b581bca6b4b9fa0049cd320360abd154b809f8700a8fd3cfaf7ca',
      published_at: '0xf5ff7d5ba73b581bca6b4b9fa0049cd320360abd154b809f8700a8fd3cfaf7ca',
      config: SDKConfig.cetusConfig,
    },
  
    clmm_pool: {
      package_id: '0x0868b71c0cba55bf0faf6c40df8c179c67a4d0ba0e79965b68b3d72d7dfbf666',
      published_at: '0x084dbc14f8f6b50e4e1d6828ebf1f93fd1b1d2502b121bc787937893793417b0',
      config: SDKConfig.clmmConfig,
    },
    integrate: {
      package_id: '0x8627c5cdcd8b63bc3daa09a6ab7ed81a829a90cafce6003ae13372d611fbb1a9',
      published_at: '0xe26cb89a7c3bb9a00b396e278f4f1f90aae02d0da37cd4b0c4b4977ca95568ef',
    },
    deepbook: {
      package_id: '0x000000000000000000000000000000000000000000000000000000000000dee9',
      published_at: '0x000000000000000000000000000000000000000000000000000000000000dee9',
    },
    deepbook_endpoint_v2: {
      package_id: '0x56d90d0c055edb534b11e7548270bb458fd47c69b77bf40c14d5eb00e6e6cf64',
      published_at: '0x56d90d0c055edb534b11e7548270bb458fd47c69b77bf40c14d5eb00e6e6cf64',
    },
    aggregatorUrl: 'https://api-sui.devcetus.com/router',
    swapCountUrl: 'https://api-sui.devcetus.com/v2/sui/pools_info',
}

async function swapCetus(){
    const sdk = new CetusClmmSDK(clmmMainnet);
    let sendKeypair = Ed25519Keypair.deriveKeypair(process.env.suimnemonic);
    sdk.senderAddress = "0xd6f6d1c3039da63c39d4c864263d01312f61e586b3d0f216f0584b20fbc77e2f";
    const a2b = true
    const byAmountIn = true
    const amount = '10000000'
    const slippage = Percentage.fromDecimal(d(0.1))

    const currentPool = await sdk.Pool.getPool('0x9ddb0d269d1049caf7c872846cc6d9152618d1d3ce994fae84c1c051ee23b179');
    console.log('currentPool: ', currentPool)

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

    // let swapPayload = await sdk.Swap.createSwapTransactionWithoutTransferCoinsPayload({
    //   pool_id: currentPool.poolAddress,
    //   a2b,
    //   by_amount_in: byAmountIn,
    //   amount: amount.toString(),
    //   amount_limit: amountLimit.toString(),
    //   coinTypeA: currentPool.coinTypeA,
    //   coinTypeB: currentPool.coinTypeB,
    // })

    // TransactionUtil.buildTransferCoinToSender(sdk, swapPayload.tx, swapPayload.coinABs[0], currentPool.coinTypeA)
    // TransactionUtil.buildTransferCoinToSender(sdk, swapPayload.tx, swapPayload.coinABs[1], currentPool.coinTypeB)

    // printTransaction(swapPayload.tx)
    // const transferTxn = await sdk.fullClient.sendTransaction(sendKeypair, swapPayload.tx)
    // console.log('swap: ', transferTxn)
};

swapCetus();
