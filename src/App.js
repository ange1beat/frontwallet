import React, { useState, useEffect } from 'react';


import { mnemonicToSeedSync } from 'bip39'
import * as bitcoin from 'bitcoinjs-lib';
import ecc from '@bitcoinerlab/secp256k1';
import { BIP32Factory } from 'bip32';

const bip32 = BIP32Factory(ecc);

function App() {
  const [inputValue, setInputValue] = useState('');
  const [address, setAddress] = useState('Your Address');
  const [src20, setSrc20] = useState([]);
  const [stamp, setStamp] = useState([]);

  const handleAddress = (address) => {
    setAddress(address)
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
    if (validateString(inputValue) === true) {

      let mnemonic = inputValue

      const seed = mnemonicToSeedSync(mnemonic);
  
      const root = bip32.fromSeed(seed, bitcoin.networks.bitcoin);
      
      const child = root.derivePath("m/84'/0'/0'/0/0");
  
      const pubKey = child.publicKey;
  
      const p2wpkh = bitcoin.payments.p2wpkh({ pubkey: pubKey });
      
      const p2sh = bitcoin.payments.p2sh({ redeem: p2wpkh });
  
      const segWitAddress = p2wpkh.address; 

      handleAddress(segWitAddress)
      await getSrc20(segWitAddress)
      await getStamp(segWitAddress)
  
      return segWitAddress
    }
  };
  

  const getSrc20 = async (address) => {
    // const url2 = `https://stampchain.io/api/v2/src20/balance/${address}`
    const url = `https://stampchain.io/api/v2/src20/balance/bc1qgeran6ygwy3hzufhgr0cv4cuajjuvxnxuftjg9`
    
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
      // const url = `https://stampchain.io/api/v2/stamps/balance/${address}`
      const url = `https://stampchain.io/api/v2/stamps/balance/bc1qgeran6ygwy3hzufhgr0cv4cuajjuvxnxuftjg9`

    fetch(url)
    .then(response => {
        if (!response.ok) {
        throw new Error('Network response was not ok');
        }
        return response.json();
    })
    .then(data => {
        const parsedData = data.data
        .filter((item) => item.stamp = 'SRC-721')
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

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-white shadow-md rounded-lg p-6">
        <input
          type="text"
          value={inputValue}
          onChange={handleChange}
          placeholder="Enter mnemonic 12 words..."
          className="w-full p-2 border border-gray-300 rounded-md"
        />
        <button
          onClick={handleSubmit}
          className="w-full bg-blue-500 text-white font-bold py-2 px-4 rounded-md mt-4 hover:bg-blue-700 transition-colors"
        >
          CHECK
        </button>
        <div className="mt-6 space-y-2">
          <p className="break-words font-extrabold">{address}</p>
          <p className='font-extrabold'>SRC-20</p>
          <div>
            {src20.map((item, index) => (
              <div key={index} className="bg-gray-400 p-2 my-2 rounded">
                {item.tick}: {item.amt.replace(/\.0+$/, '').replace(/(\.\d*[1-9])0+$/, '$1')}
              </div>
            ))}
          </div>
          <p className='font-extrabold'>SRC-721</p>
          <div>
            {stamp.map((item, index) => (
              <div key={index} className="bg-gray-400 p-2 my-2 rounded">
                <img src={item.stamp_url}></img>
                {item.stamp}: {item.balance}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
