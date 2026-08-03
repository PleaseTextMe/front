import users from '../config/users.json';

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

  register: (email, login, password) => {
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
  
  logout: () => {
    localStorage.removeItem(SESSION_KEY);
  },
  
  checkSession: () => {
    const session = localStorage.getItem(SESSION_KEY);
    return session ? JSON.parse(session) : null;
  }
};
