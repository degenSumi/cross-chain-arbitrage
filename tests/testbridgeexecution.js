const {
    TokenTransfer,
    Wormhole,
    amount,
    isTokenId,
    wormhole,
  } = require('@wormhole-foundation/sdk');
  
// const evm = require('@wormhole-foundation/sdk/evm').default;
const sui = require('@wormhole-foundation/sdk/sui').default;
const solana = require('@wormhole-foundation/sdk/solana').default;
const solanasign = require("@wormhole-foundation/sdk/platforms/solana").default;
// const evmsign = require("@wormhole-foundation/sdk/platforms/evm").default;
const suisign = require("@wormhole-foundation/sdk/platforms/sui").default;

  
(async function () {

    const wh = await wormhole('Testnet', [solana,sui]);

    // Grab chain Contexts
    const sendChain = wh.getChain('Solana');
    const rcvChain = wh.getChain('Sui');
  
    //  to allow transferring native gas token
    const token = Wormhole.tokenId(sendChain.chain, 'native');

    const amt = '0.08';

    const automatic = true;

    const nativeGas = automatic ? '0' : undefined;

    let source = await solanasign.getSigner(await sendChain.getRpc(), "SOLPRIVATEKEY", {
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
    });

    source = {
        sendChain,
        signer: source ,
        address: Wormhole.chainAddress(sendChain.chain, source.address()),
    };

    let destination = await suisign.getSigner(await rcvChain.getRpc(), "SUI MNEMONIC");

    destination = {
        rcvChain,
        signer: destination ,
        address: Wormhole.chainAddress(rcvChain.chain, destination.address()),
    };
  
    // Used to normalize the amount to account for the tokens decimals
    const decimals = isTokenId(token)
      ? Number(await wh.getDecimals(token.chain, token.address))
      : sendChain.config.nativeTokenDecimals;
  
    const roundTrip = false;
    
    // Finally create and perform the transfer given the parameters set above
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
          roundTrip
        );
  })();
  
  async function tokenTransfer(
    wh,
    route,
    roundTrip
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

    const sendChain = wh.getChain('Solana');
    const rcvChain = wh.getChain('Sui');
  
    const quote = await TokenTransfer.quoteTransfer(
      wh,
      sendChain,
      rcvChain,
      xfer.transfer
    );
    console.log(quote);

    // return;
  
    if (xfer.transfer.automatic && quote.destinationToken.amount < 0)
      throw 'The amount requested is too low to cover the fee and any native gas requested.';
  
    // 1) Submit the transactions to the source chain, passing a signer to sign any txns
    console.log('Starting transfer');
    const srcTxids = await xfer.initiateTransfer(route.source.signer);
    console.log(`Started transfer: `, srcTxids);
  
    // If automatic, we're done
    if (route.delivery?.automatic) return xfer;
  
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
  }