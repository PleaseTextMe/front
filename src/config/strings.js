/**
 * файл конфигурации текстов приложения.
 * значения в кавычках (справа от двоеточия) можно изменять для
 * автоматического обновления текстов во всем интерфейсе
 */
export const strings = {
  // === авторизация ===
  auth: {
    title: "Вход в систему",
    emailPlaceholder: "Email",
    loginPlaceholder: "Логин",
    passwordPlaceholder: "Пароль",
    submitButton: "Войти",
    errorInvalidData: "Неверный email, логин или пароль",
    registerTitle: "Регистрация",
    registerSubmitButton: "Зарегистрироваться",
    toRegisterText: "Нет аккаунта? Зарегаться",
    toLoginText: "Уже есть аккаунт? Войти",
    errorUserExists: "Пользователь с таким логином или email уже существует",
    errorPasswordsNotMatch: "Пароли не совпадают",
  },

  // === сайдбар ===
  sidebar: {
    button1: "Веня",
    button2: "Осёл (Тонинша)",
    button3: "Аркадий",
    logoutButton: "Выйти",
  },

  // === хэдер ===
  header: {
    contactName: "Пидор (Хопсо)",
    status: "Был в сети 13:37",
  },

  // === инпут ===
  input: {
    placeholder: "Напишите сообщение...",
  },

  // === логи (хз зачем) ===
  logs: {
    actionSelected: "действие:",
    messageSent: "отправлено:",
    attachmentClicked: "атачмент",
  }
};
