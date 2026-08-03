import _sodium from 'libsodium-wrappers-sumo';

// утилиты для конвертации данных
const strToUint8Array = (str) => new TextEncoder().encode(str);
const uint8ArrayToBase64 = (arr) => btoa(String.fromCharCode.apply(null, arr));

export const cryptoService = {
  // инициализация libsodium
  init: async () => {
    await _sodium.ready;
    return _sodium;
  },

  // мок запрос за солью
  generateMockSalt: async () => {
    const sodium = await cryptoService.init();
    const salt = sodium.randombytes_buf(16);
    return sodium.to_hex(salt);
  },

  // генерим ключи и вольт (сейф) при регистрации
  generateRegistrationData: async (password, saltHex) => {
    const sodium = await cryptoService.init();
    
    // деривация ключей (kdf)
    const salt = sodium.from_hex(saltHex);
    
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
  }
};