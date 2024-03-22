import React, { useState } from 'react';
import { mnemonicToSeedSync } from 'bip39';
import * as bitcoin from 'bitcoinjs-lib';
import ecc from '@bitcoinerlab/secp256k1';
import { BIP32Factory } from 'bip32';
import { ECPairFactory } from 'ecpair';

const ECPair = ECPairFactory(ecc);
const bip32 = BIP32Factory(ecc);

async function fetchUtxosForAddress(address) {
    // Note: You'll need to replace this with an API that supports the main Bitcoin network.
    const url = `https://api.blockchain.info/unspent?active=${address}`;
    const response = await fetch(url);
    const data = await response.json();
    if (!data.unspent_outputs) return [];
    return data.unspent_outputs.map(utxo => ({
        txid: utxo.tx_hash_big_endian,
        vout: utxo.tx_output_n,
        value: utxo.value,
    }));
}

async function broadcastTransaction(txHex) {
    // Note: Adjust this to a service that supports broadcasting on the main Bitcoin network.
    const response = await fetch('https://api.blockchain.info/pushtx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `tx=${txHex}`,
    });
    const data = await response.text(); // Adjust according to the API response format
    return data; // This might need adjustment based on the service's response
}

function App() {
    const [recipientAddress, setRecipientAddress] = useState('');
    const [amount, setAmount] = useState('');
    const [mnemonic, setMnemonic] = useState('');

    const handleSendBitcoin = async () => {
        const satoshiToSend = parseInt(amount * 100000000);
        const network = bitcoin.networks.bitcoin; // Changed to the main Bitcoin network
        const seed = mnemonicToSeedSync(mnemonic);
        const root = bip32.fromSeed(seed, network);
        const child = root.derivePath("m/84'/0'/0'/0/0"); // Adjusted for mainnet BIP84 path
        const privateKey = child.privateKey;
        const keyPair = ECPair.fromPrivateKey(privateKey, { network });

        const utxos = await fetchUtxosForAddress(bitcoin.payments.p2wpkh({ pubkey: child.publicKey, network }).address);

        if (utxos.length === 0) {
            console.log("No UTXOs found");
            return;
        }

        async function fetchRawTransaction(txid) {
            // Adjust this function to fetch the raw transaction from a mainnet-compatible service.
            // The URL and method might need changes based on the service you choose.
            const url = `https://blockchain.info/rawtx/${txid}?format=hex`;
            const response = await fetch(url);
            const data = await response.text(); // Adjust this based on the API response
            if (!data) throw new Error("Transaction data not found");
            return data;
        }

        const psbt = new bitcoin.Psbt({ network });
        for (const utxo of utxos) {
            const nonWitnessUtxoHex = await fetchRawTransaction(utxo.txid);
            const nonWitnessUtxo = Buffer.from(nonWitnessUtxoHex, 'hex');
            psbt.addInput({
                hash: utxo.txid,
                index: utxo.vout,
                nonWitnessUtxo, // Include the full previous transaction as nonWitnessUtxo
            });
        }

        psbt.addOutput({
            address: recipientAddress,
            value: satoshiToSend,
        });

        psbt.signAllInputs(keyPair);
        psbt.finalizeAllInputs();
        const txHex = psbt.extractTransaction().toHex();

        console.log(`Transaction Hex: ${txHex}`);
        const txId = await broadcastTransaction(txHex);
        console.log(`Transaction ID: ${txId}`);
    };

    return (
        <div>
            <input type="text" value={recipientAddress} onChange={(e) => setRecipientAddress(e.target.value)} placeholder="Recipient Address" />
            <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount to send (BTC)" />
            <input type="text" value={mnemonic} onChange={(e) => setMnemonic((e) => setMnemonic(e.target.value)} placeholder="Your mnemonic" />
            <button onClick={handleSendBitcoin}>Send Bitcoin</button>
        </div>
    );
}

export default App;

