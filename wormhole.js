const {
    TokenTransfer,
    Wormhole,
    amount,
    isTokenId,
    wormhole,
  } = require('@wormhole-foundation/sdk');
  
  const sui = require('@wormhole-foundation/sdk/sui').default;
  const solana = require('@wormhole-foundation/sdk/solana').default;
  const solanasign = require("@wormhole-foundation/sdk/platforms/solana").default;
  const suisign = require("@wormhole-foundation/sdk/platforms/sui").default;
  const dotenv = require('dotenv');
  dotenv.config();
  
  async function startbridge(options) {
  
    const wh = await wormhole('Mainnet', [solana, sui], {
      chains: {
        Solana: {
          rpc: process.env.solanarpc,
        }
      }
    });
  
    // Grab chain Contexts
    const sendChain = wh.getChain(options.sendChain);
    const rcvChain = wh.getChain(options.rcvChain);
  
    // transferring native gas token
    let token = Wormhole.tokenId(sendChain.chain, 'native');
    if (options.sendChain === "Sui")
      token = Wormhole.tokenId("Sui", "0xb7844e289a8410e50fb3ca48d69eb9cf29e27d223ef90353fe1bd8e27ff8f3f8");
  
    const amt = options.amount;
  
    const automatic = true;
  
    const nativeGas = automatic ? '0' : undefined;
  
    let source = options.sendChain === "Solana" ? await solanasign.getSigner(await sendChain.getRpc(), options.solprivatekey, {
      debug: true,
      priorityFee: {
        // take the middle priority fee
        percentile: 0.5,
        // juice the base fee taken from priority fee percentile
        percentileMultiple: 2,
        // at least 1 lamport/compute unit
        min: 1,
        // at most 1000 lamport/compute unit
        max: 1000,
      },
    }) : await suisign.getSigner(await sendChain.getRpc(), options.suiprivatekey);;
  
    source = {
      sendChain,
      signer: source,
      address: Wormhole.chainAddress(sendChain.chain, source.address()),
    };
  
    let destination = options.rcvChain === "Solana" ? await solanasign.getSigner(await rcvChain.getRpc(), options.solprivatekey, {
      debug: true,
      priorityFee: {
        percentile: 0.5,
        percentileMultiple: 2,
        min: 1,
        max: 1000,
      },
    }) : await suisign.getSigner(await rcvChain.getRpc(), options.suiprivatekey);
  
    destination = {
      rcvChain,
      signer: destination,
      address: Wormhole.chainAddress(rcvChain.chain, destination.address()),
    };
  
    // to normalize the amount to account for the tokens decimals
    const decimals = isTokenId(token)
      ? Number(await wh.getDecimals(token.chain, token.address))
      : sendChain.config.nativeTokenDecimals;
  
    // create and perform the transfer
    const xfer = await tokenTransfer(
      wh,
      {
        token,
        amount: amount.units(amount.parse(amt, decimals)),
        source,
        destination,
        delivery: {
          automatic,
          nativeGas: nativeGas
            ? amount.units(amount.parse(nativeGas, decimals))
            : undefined,
        },
      },
      options
    )
  
    return xfer;
  };
  
  async function tokenTransfer(
    wh,
    route,
    options
  ) {
    // Create a TokenTransfer object to track the state of the transfer over time
    const xfer = await wh.tokenTransfer(
      route.token,
      route.amount,
      route.source.address,
      route.destination.address,
      route.delivery?.automatic ?? false,
      route.payload,
      route.delivery?.nativeGas
    );
  
    // console.log(xfer)
  
    const sendChain = wh.getChain(options.sendChain);
    const rcvChain = wh.getChain(options.rcvChain);
  
    const quote = await TokenTransfer.quoteTransfer(
      wh,
      sendChain,
      rcvChain,
      xfer.transfer
    );
    // console.log(quote);
  
    if (!options.execute)
      return quote;
  
    // Procced in order to execute the arbitrage trade
  
    if (xfer.transfer.automatic && quote.destinationToken.amount < 0)
      throw 'The amount requested is too low to cover the fee and any native gas requested.';
  
    // 1) Submit the transactions to the source chain, passing a signer to sign any txns
    console.log('Starting transfer');
    const srcTxids = await xfer.initiateTransfer(route.source.signer);
    console.log(`Started transfer: `, srcTxids);
  
    // If automatic, we're done
    if (route.delivery?.automatic) return xfer;
  
    // For manual redmption on destination chain
    // 2) Wait for the VAA to be signed and ready (not required for auto transfer)
    console.log('Getting Attestation');
    const attestIds = await xfer.fetchAttestation(60_000);
    console.log(`Got Attestation: `, attestIds);
  
    // 3) Redeem the VAA on the dest chain
    console.log('Completing Transfer');
    const destTxids = await xfer.completeTransfer(route.destination.signer);
    console.log(`Completed Transfer: `, destTxids);
  
    // If no need to send back, dip
    if (!roundTrip) return xfer;
  
    const { destinationToken: token } = quote;
    return await tokenTransfer(wh, {
      ...route,
      token: token.token,
      amount: token.amount,
      source: route.destination,
      destination: route.source,
    });
  };
  
  // startbridge({
  //   sendChain: "Solana",
  //   rcvChain: "Sui",
  //   amount: "100",
  //   solprivatekey: "sol private key",
  //   suiprivatekey: "sui mnemonic"
  // });
  
  module.exports = {
    startbridge
  };