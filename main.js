#!/usr/bin/env node
/* eslint-disable no-magic-numbers */
/* eslint-disable no-param-reassign */
/* eslint-disable no-console */

// Description: This script serves to test all vault Electrum use cases.
// Example call: ./main.js --host 54.164.37.249 --port 50001 --ssl --testnet

const ElectrumCli = require("electrum-client");
const bitcoin = require("bitcoinjs-lib");
const yargs = require("yargs");

const TESTNET_P2SH_P2WSH = {
  messagePrefix: "\x18Bitcoin Signed Message:\n",
  bech32: "tb",
  bip32: { public: 0x024289ef, private: 0x024285b5 },
  pubKeyHash: 0x6f,
  scriptHash: 0xc4,
  wif: 0xef,
};

const MAINNET_P2SH_P2WSH = {
  messagePrefix: "\x18Bitcoin Signed Message:\n",
  bech32: "tb",
  bip32: { public: 0x049d7cb2, private: 0x049d7878 },
  pubKeyHash: 0x00,
  scriptHash: 0x05,
  wif: 0x80,
};

const fundedTestnetAddress = "tb1q7j32ycv2nan30y2jzug6lats2a9r7yjnqsx59f";
const testnetScriptHash = getScriptHash(fundedTestnetAddress);
const testnetTxId =
  "89cdf6fde736a06949ec61a213159e43f742a34fb66d8f1495c7085634205c2b";
const testnetTxBlockHeight = 2413062;

const fundedMainnetAddress = "37HMmfnCiHYKoY8cvXAGTXHgXoQHWTuGpP";
const mainnetScriptHash = getScriptHash(fundedMainnetAddress);
const mainnetTxId =
  "4856ea15c34c0b1f4f2c64b3f564ba395d801f32d0817a0d27ff5f52d30eb6a7";
const mainnetTxBlockHeight = 787794;

// Parse CLI parameters
const argv = yargs
  .group(["host", "port", "ssl", "testnet"], "Electrum server options:")
  .option("host", {
    alias: "H",
    description: "Server hostname or IP",
    type: "string",
    default: "127.0.0.1",
  })
  .option("port", {
    alias: "P",
    description: "Server port",
    type: "string",
    default: "50001",
  })
  .option("ssl", {
    alias: "s",
    description: "Use SSL",
    type: "boolean",
    default: false,
  })
  .option("testnet", {
    alias: "t",
    description: "Use bitcoin testnet",
    type: "boolean",
    default: false,
  })
  .usage("Usage: $0 [args]")
  .help()
  .alias("help", "h")
  .showHelpOnFail(true, "Specify --help for available options").argv;

// Update configuration
const electrumHost = argv.host;
const electrumPort = argv.port;
const electrumProto = argv.ssl ? "tls" : "tcp";

function getScriptHash(address) {
  let network;

  if (
    address.startsWith("2") ||
    address.startsWith("tb1") ||
    address.startsWith("m") ||
    address.startsWith("n")
  ) {
    network = TESTNET_P2SH_P2WSH;
  } else {
    network = MAINNET_P2SH_P2WSH;
  }

  const script = bitcoin.address.toOutputScript(address, network);
  const hash = bitcoin.crypto.sha256(script);
  const reversedHash = Buffer.from(hash.reverse());

  return reversedHash.toString("hex");
}

const main = async () => {
  console.log(
    `Connecting to Electrum server ${electrumProto}://${electrumHost}:${electrumPort}`
  );
  const ecl = new ElectrumCli(electrumPort, electrumHost, electrumProto);
  const scriptHash = argv.testnet ? testnetScriptHash : mainnetScriptHash;

  try {
    await ecl.connect();
  } catch (e) {
    console.log("Error connecting to Electrum:");
    console.log(e);
    throw new Error();
  }
  try {
    const ver = await ecl.server_version("Test", "1.4");
    console.log(`Version: ${ver}`);
    const feeHigh = await ecl.blockchainEstimatefee(1);
    console.log(`Fee estimate 1 blocks: ${feeHigh}`);

    const feeMed = await ecl.blockchainEstimatefee(4);
    console.log(`Fee estimate 4 blocks: ${feeMed}`);

    const feeLow = await ecl.blockchainEstimatefee(10);
    console.log(`Fee estimate 10 blocks: ${feeLow}`);

    const balance = await ecl.blockchainScripthash_getBalance(scriptHash);
    console.log({ balance });

    const scriptHashHistroy = await ecl.blockchainScripthash_getHistory(
      scriptHash
    );
    console.log(
      `Script hash history ${JSON.stringify(scriptHashHistroy, null, 2)}`
    );

    const tx = await ecl.request("blockchain.transaction.get", [
      argv.testnet ? testnetTxId : mainnetTxId,
      false,
    ]);
    console.log(`Testnet Tx ${tx}`);

    const utxos = await ecl.blockchainScripthash_listunspent(scriptHash);
    console.log(`Testnet Utxos ${JSON.stringify(utxos, null, 2)}`);

    const blockHeader = await ecl.request("blockchain.block.header", [12345]);
    console.log(`Block 12345 header: ${JSON.stringify(blockHeader, null, 2)}`);

    const merkelPath = await ecl.blockchainTransaction_getMerkle(
      argv.testnet ? testnetTxId : mainnetTxId,
      argv.testnet ? testnetTxBlockHeight : mainnetTxBlockHeight,
    );
    console.log(
      `Merkel path for txid : ${JSON.stringify(merkelPath, null, 2)}`
    );
  } catch (e) {
    console.log(e);
  }
  await ecl.close();
};

void main();
