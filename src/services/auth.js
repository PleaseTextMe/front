import users from '../config/users.json';
import { cryptoService } from './crypto';

const SESSION_KEY = 'chat_session_user';
const LOCAL_USERS_KEY = 'chat_registered_users';

const getLocalUsers = () => {
  const data = localStorage.getItem(LOCAL_USERS_KEY);
  return data ? JSON.parse(data) : [];
};

export const authService = {
  login: (login, password) => {
    // ищем пользователя, у которого совпадают логин и пароль
    let user = users.find(u => u.login === login && u.password === password);
    
    // если не нашли в users.json, ищем в localstorage
    if (!user) {
      const localUsers = getLocalUsers();
      user = localUsers.find(u => u.login === login && u.password === password);
    }
    
    if (user) {
      // сохраняем сессию в localstorage
      localStorage.setItem(SESSION_KEY, JSON.stringify(user));
      return true;
    }
    return false;
  },

  requestCode: async (email) => {
    return new Promise(resolve => {
      setTimeout(() => {
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const sessionId = 'mock-uuid-' + Date.now();
        console.log(`[system] redis mock: saved session ${sessionId} for ${email} with code ${code}`);
        resolve({ success: true, sessionId, code });
      }, 500); // имитация задержки сети
    });
  },

  register: async (email, login, password, sessionId) => {
    try {
      // мок запрос за солью (get /auth/salt)
      const saltHex = await cryptoService.generateMockSalt();
      
      // генерим ключи и вольт (сейф) (занимает ~500мс из-за argon2id)
      const cryptoData = await cryptoService.generateRegistrationData(password, saltHex);
      
      // формируем монолитный json в точности как договорились с бэкендом (pydantic snake_case)
      const payload = {
        email: email,
        username: login,
        verify_token: sessionId,
        password: password,
        salt: saltHex,
        public_bundle_json: JSON.stringify({
          bundle_json: cryptoData.publicBundle.bundleJson,
          signature: cryptoData.publicBundle.signature
        }),
        vault_json: JSON.stringify({
          encrypted_payload: cryptoData.vault.encryptedPayload,
          nonce: cryptoData.vault.nonce,
          auth_tag: cryptoData.vault.authTag
        })
      };
      
      console.log('[system] mock api: POST /api/v1/auth/register', payload);
      
      // сохраняем фейковый jwt токен (типа checkSession потом сработает)
      const mockJwt = { email, login, token: 'mock_jwt_token_from_server' };
      localStorage.setItem(SESSION_KEY, JSON.stringify(mockJwt));
      
      // костыль для мока: сохраняем креды, чтобы можно было залогиниться после логаута
      const localUsers = getLocalUsers();
      localUsers.push({ email, login, password });
      localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(localUsers));
      
      return true;
    } catch (error) {
      console.error('registration error:', error);
      return false;
    }
  },

  /*
  я его больше не использую (костыль(оставлено на всякий самый случай))
  register_old: (email, login, password) => {
    const localUsers = getLocalUsers();
    
    // проверяем, не занят ли логин или email (в обоих хранилищах)
    const isTaken = users.some(u => u.login === login || u.email === email) ||
                    localUsers.some(u => u.login === login || u.email === email);
    
    if (isTaken) {
      return false; 
    }

    const newUser = { email, login, password };
    localUsers.push(newUser);
    localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(localUsers));
    
    // сразу авторизуем после регистрации
    localStorage.setItem(SESSION_KEY, JSON.stringify(newUser));
    return true;
  },
  */
  
  logout: () => {
    localStorage.removeItem(SESSION_KEY);
  },
  
  updateAvatar: (base64String) => {
    const session = authService.checkSession();
    if (session) {
      session.avatar = base64String;
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      
      const localUsers = getLocalUsers();
      const userIndex = localUsers.findIndex(u => u.login === session.login);
      if (userIndex !== -1) {
        localUsers[userIndex].avatar = base64String;
        localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(localUsers));
      }
    }
  },

  checkSession: () => {
    const session = localStorage.getItem(SESSION_KEY);
    return session ? JSON.parse(session) : null;
  }
};
