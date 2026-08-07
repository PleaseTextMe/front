import React, { useState, useEffect } from 'react';
import Sidebar from './components/templates/Sidebar.jsx';
import ChatHeader from './components/templates/ChatHeader.jsx';
import ChatHistory from './components/templates/ChatHistory.jsx';
import ChatInput from './components/templates/ChatInput.jsx';
import AuthPage from './components/templates/AuthPage.jsx';
import AsciiFrame from './components/templates/AsciiFrame.jsx';
import ProfileSettings from './components/templates/ProfileSettings.jsx';
import { strings } from './config/strings.js';
import { authService } from './services/auth.js';
import { messageService } from './services/messageService.js';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentView, setCurrentView] = useState('chat'); // 'chat' | 'profile'
  
  const [contacts, setContacts] = useState([]);
  const [activeContact, setActiveContact] = useState(null);
  const [messages, setMessages] = useState({}); // { 'contactLogin': [...] }

  useEffect(() => {
    if (authService.checkSession()) {
      setIsAuthenticated(true);
      
      // Загружаем контакты (локальные + хардкод из strings)
      const data = localStorage.getItem('chat_registered_users');
      const localUsers = data ? JSON.parse(data).map(u => u.login) : [];
      const session = authService.checkSession();
      // Убираем себя из списка
      const allContacts = [...new Set([...strings.sidebar.usersList, ...localUsers])].filter(c => c !== session?.login);
      
      setContacts(allContacts);
      if (allContacts.length > 0) {
        setActiveContact(allContacts[0]);
      }
    }
  }, []);

  // Загрузка сообщений при смене активного контакта (или периодически)
  useEffect(() => {
    if (isAuthenticated && activeContact) {
      loadMessages(activeContact);
      // Мок-пуллинг (чтобы видеть исходящие/входящие при тесте на двух вкладках)
      const interval = setInterval(() => loadMessages(activeContact), 2000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated, activeContact]);

  const loadMessages = async (contact) => {
    const chatHistory = await messageService.getMessages(contact);
    setMessages(prev => ({ ...prev, [contact]: chatHistory }));
  };

  const handleSelectContact = (contact) => {
    setActiveContact(contact);
    setCurrentView('chat');
  };

  const handleMenuClick = () => {
    setCurrentView('profile');
    console.log(`${strings.logs.actionSelected} menu`);
  };

  const handleSendMessage = async (text) => {
    if (!activeContact) return;
    
    // Временно рисуем у себя в UI (оптимистично)
    const tempId = Date.now().toString();
    const session = authService.checkSession();
    const optimisticMsg = { id: tempId, text, sender: session.login, timestamp: Math.floor(Date.now() / 1000) };
    
    setMessages(prev => ({
      ...prev,
      [activeContact]: [...(prev[activeContact] || []), optimisticMsg]
    }));

    // Отправляем реально (моком)
    await messageService.sendMessage(activeContact, text);
    
    // Перезагружаем сообщения чтобы получить правильный ID и сохраненный стейт
    loadMessages(activeContact);
  };

  const handleLogout = () => {
    authService.logout();
    setIsAuthenticated(false);
  };

  if (!isAuthenticated) {
    return <AuthPage onLogin={() => {
      setIsAuthenticated(true);
      window.location.reload(); // Перезагружаем, чтобы useEffect отработал чисто
    }} />;
  }

  const currentMessages = activeContact ? (messages[activeContact] || []) : [];

  return (
    <div className="app-container">
      <Sidebar 
        contacts={contacts} 
        activeContact={activeContact} 
        onSelectContact={handleSelectContact} 
        onLogout={handleLogout} 
      />
      <div className="main-chat">
        <AsciiFrame>
          {currentView === 'chat' ? (
            <>
              <ChatHeader onMenuClick={handleMenuClick} />
              <ChatHistory messages={currentMessages} />
              <ChatInput onSendMessage={handleSendMessage} />
            </>
          ) : (
            <ProfileSettings onBack={() => setCurrentView('chat')} />
          )}
        </AsciiFrame>
      </div>
    </div>
  );
}

export default App;
