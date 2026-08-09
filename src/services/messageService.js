import { authService } from './auth';
import { cryptoService } from './crypto';

const MESSAGES_API_URL = import.meta.env.VITE_MESSAGES_API_URL || 'http://localhost:8001/api/v1/messages';

export const messageService = {
  getContactKeys: async (contactLogin) => {
    try {
      const response = await fetch(import.meta.env.VITE_AUTH_API_URL || 'http://localhost:8000/api/v1/users/');
      if (response.ok) {
        const users = await response.json();
        const user = users.find(u => u.username === contactLogin);
        if (user && user.public_bundle) {
          // В auth мы храним public_bundle как словарь: { bundle_json: "...", signature: "..." }
          // cryptoService ожидает bundle_json как распаршенный объект
          return JSON.parse(user.public_bundle.bundle_json);
        }
      }
    } catch (e) {
      console.error("Failed to fetch contact keys:", e);
    }
    return null;
  },

  // Загрузить историю переписки
  getMessages: async (contactLogin) => {
    const session = authService.checkSession();
    if (!session) return [];
    const myLogin = session.login;
    
    let chatMsgs = [];
    try {
      const response = await fetch(`${MESSAGES_API_URL}/?recipient_login=${contactLogin}`, {
        headers: { "x-auth-token": session.token }
      });
      if (response.ok) {
        chatMsgs = await response.json();
      } else {
        console.error("Failed to fetch messages", await response.text());
      }
    } catch (err) {
      console.error("Error connecting to sending microservice:", err);
    }

    // Расшифровываем
    const decryptedMsgs = [];
    for (const m of chatMsgs) {
      if (m.sender_login === myLogin) {
        // Мы отправили. Расшифровываем своим приватным ключом и публичным ключом получателя
        const recipientKeys = await messageService.getContactKeys(m.recipient_login);
        if (recipientKeys && session.keys) {
          try {
            const text = await cryptoService.decryptMessage(
              m.ciphertext, 
              m.nonce, 
              session.keys.agreement_priv_x25519, 
              recipientKeys.agreement_pub_x25519
            );
            decryptedMsgs.push({ ...m, text });
          } catch (e) {
            decryptedMsgs.push({ ...m, text: "[ошибка расшифровки]" });
          }
        } else {
          decryptedMsgs.push({ ...m, text: "[ошибка: нет ключей получателя]" });
        }
      } else {
        const senderKeys = await messageService.getContactKeys(m.sender_login);
        if (senderKeys && session.keys) {
          try {
            const text = await cryptoService.decryptMessage(
              m.ciphertext, 
              m.nonce, 
              session.keys.agreement_priv_x25519, 
              senderKeys.agreement_pub_x25519
            );
            decryptedMsgs.push({ ...m, text });
          } catch (e) {
            decryptedMsgs.push({ ...m, text: "[ошибка расшифровки]" });
          }
        } else {
          decryptedMsgs.push({ ...m, text: "[ошибка: нет ключей отправителя]" });
        }
      }
    }
    
    return decryptedMsgs.map(m => ({
      id: m.id,
      text: m.text,
      sender: m.sender_login,
      timestamp: m.timestamp
    }));
  },

  // Отправить сообщение
  sendMessage: async (recipientLogin, text) => {
    const session = authService.checkSession();
    if (!session) return false;

    const recipientKeys = await messageService.getContactKeys(recipientLogin);
    
    let encrypted = { ciphertext: "mock_cipher", nonce: "mock_nonce" };
    
    if (recipientKeys && session.keys) {
      encrypted = await cryptoService.encryptMessage(
        text,
        session.keys.agreement_priv_x25519,
        recipientKeys.agreement_pub_x25519
      );
    } else {
      console.warn("Нет публичных ключей получателя. (сообщение не зашифровано!)");
    }

    try {
      const response = await fetch(`${MESSAGES_API_URL}/`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "x-auth-token": session.token
        },
        body: JSON.stringify({
          recipient_login: recipientLogin,
          ciphertext: encrypted.ciphertext,
          nonce: encrypted.nonce
        })
      });

      return response.ok;
    } catch (err) {
      console.error("Failed to send message via microservice:", err);
      return false;
    }
  }
};
