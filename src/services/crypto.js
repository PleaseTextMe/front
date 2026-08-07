import _sodium from 'libsodium-wrappers-sumo';

// утилиты для конвертации данных
const strToUint8Array = (str) => new TextEncoder().encode(str);
const uint8ArrayToBase64 = (arr) => btoa(String.fromCharCode.apply(null, arr));
const base64ToUint8Array = (base64) => {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
};

export const cryptoService = {
  // инициализация libsodium
  init: async () => {
    await _sodium.ready;
    return _sodium;
  },

  // статичная соль (заглушка для argon2id, так как мы отказались от серверной соли)
  staticSalt: new Uint8Array(16),

  // генерим ключи и вольт (сейф) при регистрации
  generateRegistrationData: async (password) => {
    const sodium = await cryptoService.init();
    
    // деривация ключей (kdf) с использованием хардкодной соли
    const salt = cryptoService.staticSalt;
    
    const derivedKey = sodium.crypto_pwhash(
      64,
      strToUint8Array(password),
      salt,
      sodium.crypto_pwhash_OPSLIMIT_INTERACTIVE,
      sodium.crypto_pwhash_MEMLIMIT_INTERACTIVE,
      sodium.crypto_pwhash_ALG_ARGON2ID13
    );

    // разделяем 64 байта на auth и vault ключи
    const keyAuth = derivedKey.slice(0, 32);
    const keyVault = derivedKey.slice(32, 64);

    // хэшируем key_auth для отправки на сервер
    const authHash = sodium.crypto_generichash(32, keyAuth);

    // генерация e2e ключей
    const identityKeypair = sodium.crypto_sign_keypair();
    const agreementKeypair = sodium.crypto_box_keypair();
    
    // ml-kem (заглушка до подключения wasm-порта kyber)
    // генерируем случайные байты в качестве заглушки
    const pqKemPub = sodium.randombytes_buf(1184);
    const pqKemPriv = sodium.randombytes_buf(2400);

    // формирование и шифрование сейфа (vault)
    const vaultData = JSON.stringify({
      identity_priv_ed25519: uint8ArrayToBase64(identityKeypair.privateKey),
      agreement_priv_x25519: uint8ArrayToBase64(agreementKeypair.privateKey),
      pq_kem_priv_mlkem: uint8ArrayToBase64(pqKemPriv)
    });

    // шифрование aes-gcm через web crypto api (т.к. браузер поддерживает аппаратно)
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      keyVault,
      "AES-GCM",
      false,
      ["encrypt"]
    );
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encryptedBuffer = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: iv },
      cryptoKey,
      strToUint8Array(vaultData)
    );
    
    const encryptedArray = new Uint8Array(encryptedBuffer);
    // web crypto api прикрепляет auth_tag в конец ciphertext (последние 16 байт)
    const ciphertext = encryptedArray.slice(0, -16);
    const authTag = encryptedArray.slice(-16);

    // формирование публичного бандла
    const publicBundle = JSON.stringify({
      identity_pub_ed25519: uint8ArrayToBase64(identityKeypair.publicKey),
      agreement_pub_x25519: uint8ArrayToBase64(agreementKeypair.publicKey),
      pq_kem_pub_mlkem: uint8ArrayToBase64(pqKemPub)
    });

    // подписываем публичный бандл приватным ключом ed25519
    const signature = sodium.crypto_sign_detached(
      strToUint8Array(publicBundle),
      identityKeypair.privateKey
    );

    return {
      authHash: uint8ArrayToBase64(authHash),
      vault: {
        encryptedPayload: uint8ArrayToBase64(ciphertext),
        nonce: uint8ArrayToBase64(iv),
        authTag: uint8ArrayToBase64(authTag)
      },
      publicBundle: {
        bundleJson: publicBundle,
        signature: uint8ArrayToBase64(signature)
      }
    };
  },

  // расшифровка vault при логине
  decryptVault: async (password, vaultData) => {
    const sodium = await cryptoService.init();
    const salt = cryptoService.staticSalt;

    // 1. Деривация ключа для расшифровки
    const derivedKey = sodium.crypto_pwhash(
      64,
      strToUint8Array(password),
      salt,
      sodium.crypto_pwhash_OPSLIMIT_INTERACTIVE,
      sodium.crypto_pwhash_MEMLIMIT_INTERACTIVE,
      sodium.crypto_pwhash_ALG_ARGON2ID13
    );
    const keyVault = derivedKey.slice(32, 64);

    // 2. Декодируем base64 в байты
    const ciphertext = base64ToUint8Array(vaultData.encrypted_payload);
    const authTag = base64ToUint8Array(vaultData.auth_tag);
    const nonce = base64ToUint8Array(vaultData.nonce);

    // 3. Web Crypto API требует склеенный буфер (ciphertext + auth_tag)
    const encryptedBuffer = new Uint8Array(ciphertext.length + authTag.length);
    encryptedBuffer.set(ciphertext);
    encryptedBuffer.set(authTag, ciphertext.length);

    // 4. Расшифровываем
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      keyVault,
      "AES-GCM",
      false,
      ["decrypt"]
    );
    
    try {
      const decryptedBuffer = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: nonce },
        cryptoKey,
        encryptedBuffer
      );
      
      const decryptedString = new TextDecoder().decode(decryptedBuffer);
      return JSON.parse(decryptedString); // { identity_priv_ed25519, ... }
    } catch (e) {
      console.error("Vault decryption failed:", e);
      return null;
    }
  },

  // шифрование сообщения
  encryptMessage: async (text, myPrivateKeyBase64, recipientPublicKeyBase64) => {
    const sodium = await cryptoService.init();
    const nonce = sodium.randombytes_buf(sodium.crypto_box_NONCEBYTES);
    
    const messageBytes = strToUint8Array(text);
    const myPriv = base64ToUint8Array(myPrivateKeyBase64);
    const theirPub = base64ToUint8Array(recipientPublicKeyBase64);
    
    const ciphertext = sodium.crypto_box_easy(messageBytes, nonce, theirPub, myPriv);
    
    return {
      ciphertext: uint8ArrayToBase64(ciphertext),
      nonce: uint8ArrayToBase64(nonce)
    };
  },

  // расшифровка сообщения
  decryptMessage: async (ciphertextBase64, nonceBase64, myPrivateKeyBase64, senderPublicKeyBase64) => {
    const sodium = await cryptoService.init();
    
    const ciphertext = base64ToUint8Array(ciphertextBase64);
    const nonce = base64ToUint8Array(nonceBase64);
    const myPriv = base64ToUint8Array(myPrivateKeyBase64);
    const theirPub = base64ToUint8Array(senderPublicKeyBase64);
    
    try {
      const decrypted = sodium.crypto_box_open_easy(ciphertext, nonce, theirPub, myPriv);
      return new TextDecoder().decode(decrypted);
    } catch (e) {
      console.error("message decryption failed:", e);
      return "[зашифрованное сообщение]";
    }
  }
};