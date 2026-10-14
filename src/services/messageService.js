import { authService } from './auth';
import { cryptoService } from './crypto';

const MESSAGES_API_URL = import.meta.env.VITE_MESSAGES_API_URL || 'http://localhost:8001/api/v1/messages';
const USERS_API_URL = import.meta.env.VITE_AUTH_API_URL || `${(import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1').replace(/\/$/, '')}/users/`;

export const getMessagesWebSocketUrl = (token) => {
  const url = new URL(`${MESSAGES_API_URL.replace(/\/$/, '')}/ws`, window.location.href);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.searchParams.set('token', token);
  return url.toString();
};

export const messageService = {
  getContactKeys: async (contactLogin) => {
    try {
      const response = await fetch(USERS_API_URL);
      if (response.ok) {
        const users = await response.json();
        const user = users.find(u => u.username === contactLogin);
        if (user && user.public_bundle) {
          // В auth мы храним public_bundle как словарь: { bundle_json: "...", signature: "..." }
          // cryptoService ожидает bundle_json как распаршенный объект
          return await cryptoService.verifyPublicBundle(user.public_bundle);
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
      const response = await fetch(`${MESSAGES_API_URL.replace(/\/$/, '')}/?recipient_login=${encodeURIComponent(contactLogin)}`, {
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
    const contactKeys = new Map();
    const getKeys = (login) => {
      if (!contactKeys.has(login)) contactKeys.set(login, messageService.getContactKeys(login));
      return contactKeys.get(login);
    };
    for (const m of chatMsgs) {
      if (m.sender_login === myLogin) {
        // Мы отправили. Расшифровываем своим приватным ключом и публичным ключом получателя
        const recipientKeys = await getKeys(m.recipient_login);
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
        const senderKeys = await getKeys(m.sender_login);
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
    
    let encrypted;
    
    if (recipientKeys && session.keys) {
      try {
        encrypted = await cryptoService.encryptMessage(
          text,
          session.keys.agreement_priv_x25519,
          recipientKeys.agreement_pub_x25519
        );
      } catch (error) {
        console.error('Message encryption failed:', error);
        return false;
      }
    } else {
      return false;
    }

    try {
      const response = await fetch(`${MESSAGES_API_URL.replace(/\/$/, '')}/`, {
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
