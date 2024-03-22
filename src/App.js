import React, { useState, useEffect } from 'react';
import { mnemonicToSeedSync } from 'bip39'
import * as bitcoin from 'bitcoinjs-lib';
import ecc from '@bitcoinerlab/secp256k1';
import { BIP32Factory } from 'bip32';
import { BrowserRouter as Router, Routes, Route, Link, useNavigate } from 'react-router-dom';
import { ECPairFactory } from 'ecpair';

const ECPair = ECPairFactory(ecc);

const bip32 = BIP32Factory(ecc);

function Home({ onSubmit, inputValue, handleChange, isLoggedIn, address, btcBalance, src20, stamp, btcPriceUsd }) {

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4" style={{ background: 'linear-gradient(180deg, #ffffff 0%, #00BFFF 100%)', fontFamily: '"Press Start 2P", cursive' }}>
      <div className="w-full max-w-md bg-white shadow-md rounded-lg p-6">
      <input
          type="text"
          value={inputValue}
          onChange={handleChange}
          placeholder="enter mnemonic 12 words"
          className="w-full p-2 border border-gray-300 rounded-md"
        />
        <button
          onClick={onSubmit}
          className="w-full bg-blue-500 text-white font-bold py-2 px-4 rounded-md mt-4 hover:bg-blue-700 transition-colors"
        >
          LOGIN
        </button>
        {isLoggedIn && ( // Элемент отображается только если пользователь вошел в систему
          <div>
            <Link to="/send" className="block mt-4 text-center text-blue-500 hover:text-blue-700">Send Bitcoin</Link>
          </div>
        )}
        <div className="mt-6 space-y-2">
          <p className="break-words font-extrabold">{address}</p>
          <p className='break-words font-extrabold'>
          {btcBalance} BTC 
          <span style={{color: 'grey'}}> ~ ${(btcPriceUsd * btcBalance).toFixed(2)}</span>
          </p>
          <p className='font-extrabold pt-4'>SRC-20</p>
          <div className='pt-4'>
            {src20.map((item, index) => (
              <div key={index} className="bg-gray-400 p-2 my-2 rounded">
                {item.tick}: {item.amt.replace(/\.0+$/, '').replace(/(\.\d*[1-9])0+$/, '$1')}
              </div>
            ))}
          </div>
          <div>
          <p className='font-extrabold pt-4'>SRC-721 & STAMP</p>
          <div className="mt-6 space-y-2">
            <div className="flex flex-wrap -m-2">
              {stamp.map((item, index) => (
                <div key={index} className="w-1/2 p-2">
                  <div className="bg-gray-400 p-2 rounded flex flex-col items-center">
                    <img 
                      src={item.stamp_url} 
                      alt="" 
                      className="w-full h-48 object-contain" // Установите фиксированную высоту и автоматическую ширину с сохранением пропорций
                      style={{minWidth: '100%', minHeight: '100%'}} // Гарантирует, что изображение будет растягиваться для заполнения контейнера
                    />
                    <span>{item.stamp}: {item.balance}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          </div>
      </div>
    </div>
    </div>
  );
}

function SendBitcoin({onSubmit, address, inputValue}) {
  const [recipientAddress, setRecipientAddress] = useState('');
  const [amount, setAmount] = useState('');
  const navigate = useNavigate();

  const navigator = () => {
    navigate(-1)
    onSubmit()
  }

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

  const handleSendBitcoin = async (mnemonic) => {
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
    <div className="min-h-screen flex flex-col items-center justify-center p-4" style={{ background: 'linear-gradient(180deg, #ffffff 0%, #00BFFF 100%)', fontFamily: '"Press Start 2P", cursive' }}>
      <div className="w-full max-w-md bg-white shadow-md rounded-lg p-6">
        <input
          type="text"
          value={recipientAddress}
          onChange={(e) => setRecipientAddress(e.target.value)}
          placeholder="recipient address"
          className="w-full p-2 border border-gray-300 rounded-md"
        />
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="amount"
          className="w-full p-2 border border-gray-300 rounded-md mt-4"
        />
        <button
          onClick={() => handleSendBitcoin(inputValue)}
          className="w-full bg-blue-500 text-white font-bold py-2 px-4 rounded-md mt-4 hover:bg-blue-700 transition-colors"
        >
          Send
        </button>
        <button
          onClick={() => navigator()} 
          className="w-full bg-gray-500 text-white font-bold py-2 px-4 rounded-md mt-2 hover:bg-gray-700 transition-colors">
          Back
        </button>
      </div>
    </div>
  );
}

function App() {

  const [inputValue, setInputValue] = useState(localStorage.getItem('mnemonic') || '');
  const [address, setAddress] = useState('your address');
  const [src20, setSrc20] = useState([]);
  const [stamp, setStamp] = useState([]);
  const [btcBalance, setBtcBalance] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(localStorage.getItem('isLoggedIn') === 'true');
  const [btcPriceUsd, setBtcPriceUsd] = useState(0);

  useEffect(() => {
    fetchBtcPrice().then(price => {
      if (price) {
        setBtcPriceUsd(price);
      }
    });
  }, []);

  useEffect(() => {
    // Сохраняем мнемоническую фразу в localStorage каждый раз, когда она изменяется
    localStorage.setItem('mnemonic', inputValue);
  }, [inputValue]);

  useEffect(() => {
    // Сохраняем состояние входа пользователя
    localStorage.setItem('isLoggedIn', isLoggedIn);
  }, [isLoggedIn]);
  
  const handleAddress = (address) => {
    setAddress(address);
  };

  function validateString(inputString) {
    // Разбиваем строку на отдельные слова
    const words = inputString.split(/\s+/);

    // Проверяем, что количество слов равно 12
    if (words.length !== 12) {
        return false;
    }

    // Создаем множество для хранения уникальных слов
    const uniqueWords = new Set(words);

    // Проверяем, что количество уникальных слов равно 12
    if (uniqueWords.size !== 12) {
        return false;
    }

    // Проверяем, что каждое слово состоит только из английских букв
    const englishAlphabetRegex = /^[a-zA-Z]+$/;
    for (const word of uniqueWords) {
        if (!englishAlphabetRegex.test(word)) {
            return false;
        }
    }

    // Все проверки пройдены успешно, строка валидна
    return true;
}

  const handleChange = (event) => {
    setInputValue(event.target.value);
  };

  const handleSubmit = async () => {
    if (validateString(inputValue)) {
      let mnemonic = inputValue;
      const seed = mnemonicToSeedSync(mnemonic);
      const root = bip32.fromSeed(seed, bitcoin.networks.bitcoin);
      const child = root.derivePath("m/84'/0'/0'/0/0");
      const pubKey = child.publicKey;
      const p2wpkh = bitcoin.payments.p2wpkh({ pubkey: pubKey });
      const segWitAddress = p2wpkh.address;

      handleAddress(segWitAddress);
      await getSrc20(segWitAddress);
      await getStamp(segWitAddress);
      await getBtcBalance(segWitAddress);
      setIsLoggedIn(true); // Устанавливаем состояние входа в систему в true
      return segWitAddress;
    } else {
      alert('Invalid mnemonic. Please enter a valid 12-word mnemonic phrase.');
    }
  };
  

  const getSrc20 = async (address) => {
    const url2 = `https://stampchain.io/api/v2/src20/balance/${address}`

    
    fetch(url)
    .then(response => {
        if (!response.ok) {
        throw new Error('Network response was not ok');
        }
        return response.json();
    })
    .then(data => {
        const parsedData = data.data
        .map(item => ({
            tick: item.tick,
            amt: item.amt
        }))
        setSrc20(parsedData)
    })
    .catch(error => {
        console.error('There was a problem with the fetch operation:', error);
    });

  }

  const getStamp = async (address) => {
      const url = `https://stampchain.io/api/v2/stamps/balance/${address}`

    fetch(url)
    .then(response => {
        if (!response.ok) {
        throw new Error('Network response was not ok');
        }
        return response.json();
    })
    .then(data => {
        const parsedData = data.data
        .map(item => ({
            stamp: item.stamp,
            balance: item.balance,
            stamp_url: item.stamp_url
        }))
        setStamp(parsedData)
    })
    .catch(error => {
        console.error('There was a problem with the fetch operation:', error);
    });
  }

  const getBtcBalance = async (address) => {

     const url = `https://api.blockcypher.com/v1/btc/main/addrs/${address}/balance`;

    fetch(url)
      .then(response => response.json())
      .then(data => {
        let balanceInBtc = (data.balance / 100000000).toFixed(8)
        setBtcBalance(balanceInBtc)
      })
      .catch(error => console.error('Ошибка:', error));
  }

  async function fetchBtcPrice() {
    try {
      const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd');
      const data = await response.json();
      return data.bitcoin.usd; // Возвращает текущую стоимость BTC в USD
    } catch (error) {
      console.error('Error fetching BTC price:', error);
      return null;
    }
  }
  

  return (
    <Router>
      <Routes> 
      <Route path="/send" element={<SendBitcoin onSubmit={handleSubmit} address={address} inputValue={inputValue}/>} />
      <Route path="/" element={<Home onSubmit={handleSubmit} btcPriceUsd={btcPriceUsd} inputValue={inputValue} handleChange={handleChange} isLoggedIn={isLoggedIn} address={address} btcBalance={btcBalance} src20={src20} stamp={stamp} />} />
      </Routes>
    </Router>
  );
}

export default App;
