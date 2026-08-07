/**
 * файл конфигурации текстов приложения.
 * значения в кавычках (справа от двоеточия) можно изменять для
 * автоматического обновления текстов во всем интерфейсе
 */
export const strings = {
  // === авторизация ===
  auth: {
    title: "=== SYSTEM LOGIN ===",
    emailPlaceholder: "email:",
    loginPlaceholder: "username:",
    passwordPlaceholder: "password:",
    confirmPasswordPlaceholder: "confirm_pwd:",
    submitButton: "[ LOGIN ]",
    errorInvalidData: "[ERROR] неверные данные",
    registerTitle: "=== USER REGISTRATION ===",
    registerSubmitButton: "[ REGISTER ]",
    toRegisterText: "[ GO_TO_REGISTER ]",
    toLoginText: "[ GO_TO_LOGIN ]",
    errorUserExists: "[ERROR] юзер существует",
    errorPasswordsNotMatch: "[ERROR] пароли не совпадают",
    errorInvalidChars: "[ERROR] используйте только латиницу и символы",
    verificationTitle: "=== 2FA VERIFICATION ===",
    verificationSubtitle: "enter 6-digit code from email:",
    verificationPlaceholder: "code:",
    getCodeButton: "[ GET CODE ]",
    verifySubmitButton: "[ VERIFY CODE ]",
    emailVerifiedText: "[ EMAIL VERIFIED ]",
    errorInvalidCode: "[ERROR] access denied. invalid code.",
  },

  profile: {
    title: "=== PROFILE SETTINGS ===",
    uploadLabel: "select photo:",
    resolutionLabel: "ascii resolution:",
    saveButton: "[ SAVE AVATAR ]",
    backButton: "[ BACK TO CHAT ]"
  },

  // === сайдбар ===
  sidebar: {
    title: "=== USERS ===",
    usersList: ['веня', 'осёл', 'аркадий'],
    logoutButton: "[ LOGOUT ]",
  },

  // === хэдер ===
  header: {
    contactName: "пидор (хопсо)",
    status: "в сети",
    menuButton: "[ MENU ]",
    prefix: "connected to: ",
    statusPrefix: "status: "
  },

  // === инпут ===
  input: {
    prompt: "user@chat:~$",
    submitButton: "[ SEND ]",
  },

  // === чат (history) ===
  chat: {
    systemUser: "<system>:",
    localUser: "<you>:",
    connectionMsg: " connection established.",
  },

  // === логи (хз зачем) ===
  logs: {
    actionSelected: "action:",
    messageSent: "message:",
    attachmentClicked: "attachment",
  }
};
