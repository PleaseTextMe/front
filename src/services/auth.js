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

  register: async (email, login, password) => {
    try {
      // мок запрос за солью (get /auth/salt)
      const saltHex = await cryptoService.generateMockSalt();
      
      // генерим ключи и вольт (сейф) (занимает ~500мс из-за argon2id)
      const cryptoData = await cryptoService.generateRegistrationData(password, saltHex);
      
      // мокируем 3 запроса на бэкенд
      console.log('mock api: post /auth/register', { username: login, auth_hash: cryptoData.authHash });
      console.log('mock api: post /keys/vault', cryptoData.vault);
      console.log('mock api: post /keys/public', cryptoData.publicBundle);
      
      // сохраняем фейковый jwt токен (типа chekcSession потом сработает)
      const mockJwt = { email, login, token: 'mock_jwt_token_from_server' };
      localStorage.setItem(SESSION_KEY, JSON.stringify(mockJwt));
      
      return true;
    } catch (error) {
      console.error('registration error:', error);
      return false;
    }
  },

  /*
  я его больше не использую (оставлено на всякий самый случай)
  register_old: (email, login, password) => {
    // АРКАДИЙ, вся эта логика с регистрацией в localstorage — это временная заглушка (костыль)
    // потом этот блок можно будет полностью вырезать при подключении нормального бэкенда
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
  
  checkSession: () => {
    const session = localStorage.getItem(SESSION_KEY);
    return session ? JSON.parse(session) : null;
  }
};
