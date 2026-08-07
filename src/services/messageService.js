import { authService } from './auth';
import { cryptoService } from './crypto';

const MOCK_MESSAGES_KEY = 'chat_mock_messages';

export const messageService = {
  // Получить публичные ключи контакта (в моке просто дергаем из local storage регистрации)
  getContactKeys: async (contactLogin) => {
    // В реальном API будет GET /api/v1/users/${contactLogin}/keys
    const data = localStorage.getItem('chat_registered_users');
    const users = data ? JSON.parse(data) : [];
    const user = users.find(u => u.login === contactLogin);
    if (user && user.publicBundle) {
      return JSON.parse(user.publicBundle.bundleJson);
    }
    // Для хардкод юзеров из users.json (веня, осёл) ключей нет, возвращаем null
    return null;
  },

  // Загрузить историю переписки
  getMessages: async (contactLogin) => {
    // В реальном API будет GET /api/v1/messages/?contact=${contactLogin}
    const data = localStorage.getItem(MOCK_MESSAGES_KEY);
    const allMessages = data ? JSON.parse(data) : [];
    
    const session = authService.checkSession();
    if (!session) return [];
    const myLogin = session.login;
    
    // Фильтруем сообщения между мной и контактом
    const chatMsgs = allMessages.filter(m => 
      (m.sender_login === myLogin && m.recipient_login === contactLogin) ||
      (m.sender_login === contactLogin && m.recipient_login === myLogin)
    );

    // Расшифровываем
    const decryptedMsgs = [];
    for (const m of chatMsgs) {
      if (m.sender_login === myLogin) {
        // Мы отправили. Так как зашифровали чужим ключом, расшифровать своим не сможем.
        // Для мока юзаем поле plaintext (читерство, бэкенд его хранить не будет).
        // В реале мы будем кэшировать исходящие локально или шифровать копию для себя.
        decryptedMsgs.push({ ...m, text: m.plaintext || "[зашифрованное исходящее]" });
      } else {
        // Нам прислали
        const senderKeys = await messageService.getContactKeys(m.sender_login);
        if (senderKeys && session.keys) {
          const text = await cryptoService.decryptMessage(
            m.ciphertext, 
            m.nonce, 
            session.keys.agreement_priv_x25519, 
            senderKeys.agreement_pub_x25519
          );
          decryptedMsgs.push({ ...m, text });
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

    const newMessage = {
      id: Date.now().toString(),
      sender_login: session.login,
      recipient_login: recipientLogin,
      timestamp: Math.floor(Date.now() / 1000),
      ciphertext: encrypted.ciphertext,
      nonce: encrypted.nonce,
      plaintext: text // ЧИТЕРСТВО для мока, чтобы видеть свои исходящие при рефреше
    };

    const data = localStorage.getItem(MOCK_MESSAGES_KEY);
    const allMessages = data ? JSON.parse(data) : [];
    allMessages.push(newMessage);
    localStorage.setItem(MOCK_MESSAGES_KEY, JSON.stringify(allMessages));

    return true;
  }
};
