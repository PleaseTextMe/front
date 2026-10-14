import { cryptoService } from './crypto';

const SESSION_KEY = 'chat_session_user';
const LOCAL_USERS_KEY = 'chat_registered_users';
const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1').replace(/\/$/, '') + '/auth';

const getLocalUsers = () => {
  const data = localStorage.getItem(LOCAL_USERS_KEY);
  return data ? JSON.parse(data) : [];
};

export const authService = {
  login: async (email, password) => {
    let authToken;
    try {
      const parametersResponse = await fetch(`${API_BASE}/login-parameters/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      if (!parametersResponse.ok) throw new Error('failed to get login parameters');
      const { auth_version: authVersion } = await parametersResponse.json();
      if (authVersion !== 1 && authVersion !== 2) throw new Error('unsupported authentication version');
      const credential = authVersion === 2
        ? await cryptoService.deriveAuthCredential(password, email)
        : password;
      // 1. Делаем POST запрос для логина (получаем auth_token)
      const loginResponse = await fetch(`${API_BASE}/login/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: credential })
      });

      if (!loginResponse.ok) {
        throw new Error('invalid credentials');
      }
      
      const loginData = await loginResponse.json();
      authToken = loginData.auth_token;

      // 2. Получаем профиль пользователя, чтобы достать vault
      const meResponse = await fetch(`${API_BASE}/me/`, {
        method: 'GET',
        headers: { 'x-auth-token': authToken }
      });

      if (!meResponse.ok) {
        throw new Error('failed to get profile');
      }

      const user = await meResponse.json();

      // 3. Расшифровываем vault с помощью пароля
      const decryptedKeys = await cryptoService.decryptVault(password, user.vault);
      if (!decryptedKeys) {
        throw new Error('failed to decrypt vault (wrong password?)');
      }

      // 4. Сохраняем сессию
      const sessionData = {
        email: user.email,
        login: user.username,
        token: authToken,
        keys: decryptedKeys
      };
      
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));
      return true;
    } catch (e) {
      if (authToken) {
        try {
          await fetch(`${API_BASE}/logout/`, { method: 'POST', headers: { 'x-auth-token': authToken } });
        } catch { /* Preserve the original login failure. */ }
      }
      console.error('login error:', e);
      return false;
    }
  },

  requestCode: async (email) => {
    try {
      const response = await fetch(`${API_BASE}/send-verify-code/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      if (!response.ok) {
        if (response.status === 409) {
          return { success: false, error: 'User already exists' };
        }
        throw new Error('failed to send code');
      }
      const data = await response.json();
      return { success: true, verifyToken: data.verify_token };
    } catch (e) {
      console.error(e);
      return { success: false };
    }
  },

  verifyCode: async (email, code, verifyToken) => {
    try {
      const response = await fetch(`${API_BASE}/check-verify-code/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email, 
          code: parseInt(code, 10), 
          verify_token: verifyToken 
        })
      });
      if (!response.ok) {
        if (response.status === 409) {
          return { success: false, error: 'User already exists' };
        }
        return { success: false, error: 'Invalid code' };
      }
      const data = await response.json();
      return { success: data.is_verified };
    } catch (e) {
      console.error(e);
      return { success: false, error: 'Network error' };
    }
  },

  register: async (email, login, password, verifyToken) => {
    try {
      // Generate encryption keys and a randomly salted vault.
      const cryptoData = await cryptoService.generateRegistrationData(password, email);
      
      // формируем нормальный вложенный json для бэкенда
      const payload = {
        email: email,
        username: login,
        verify_token: verifyToken,
        password: cryptoData.authHash,
        public_bundle: {
          bundle_json: cryptoData.publicBundle.bundleJson,
          signature: cryptoData.publicBundle.signature
        },
        vault: {
          encrypted_payload: cryptoData.vault.encryptedPayload,
          nonce: cryptoData.vault.nonce,
          auth_tag: cryptoData.vault.authTag,
          kdf_salt: cryptoData.vault.kdfSalt,
          auth_version: 2
        }
      };
      
      const response = await fetch(`${API_BASE}/register/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error('registration failed on backend');
      }

      const data = await response.json();
      
      // сохраняем реальный auth токен от сервера вместе с ключами, чтобы можно было шифровать сообщения без релогина
      const sessionData = { 
        email, 
        login, 
        token: data.auth_token,
        keys: cryptoData.keys // Добавили ключи в сессию!
      };
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));
      
      return true;
    } catch (error) {
      console.error('registration error:', error);
      return false;
    }
  },

  logout: async () => {
    const session = authService.checkSession();
    sessionStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(SESSION_KEY);
    if (session && session.token) {
      try {
        await fetch(`${API_BASE}/logout/`, {
          method: 'POST',
          headers: {
            'x-auth-token': session.token
          }
        });
      } catch (e) {
        console.error('logout error:', e);
      }
    }
  },
  
  updateAvatar: (base64String) => {
    const session = authService.checkSession();
    if (session) {
      session.avatar = base64String;
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
      
      const localUsers = getLocalUsers();
      const userIndex = localUsers.findIndex(u => u.login === session.login);
      if (userIndex !== -1) {
        localUsers[userIndex].avatar = base64String;
        localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(localUsers));
      }
    }
  },

  checkSession: () => {
    try {
      const session = sessionStorage.getItem(SESSION_KEY) || localStorage.getItem(SESSION_KEY);
      if (!session) return null;
      const parsed = JSON.parse(session);
      if (!parsed?.token || !parsed?.login || !parsed?.keys) throw new Error('Invalid session');
      sessionStorage.setItem(SESSION_KEY, session);
      localStorage.removeItem(SESSION_KEY);
      return parsed;
    } catch {
      sessionStorage.removeItem(SESSION_KEY);
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
  }
};
