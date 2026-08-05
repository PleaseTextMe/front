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

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentView, setCurrentView] = useState('chat'); // 'chat' | 'profile'
  const [messages, setMessages] = useState([]);

  // проверяем наличие сессии в локалсторадже при загрузке апликухи
  useEffect(() => {
    if (authService.checkSession()) {
      setIsAuthenticated(true);
    }
  }, []);

  const handleAction = (type) => {
    console.log(`action: ${type}`);
  };

  const handleMenuClick = () => {
    setCurrentView('profile');
    console.log(`${strings.logs.actionSelected} menu`);
  };

  const handleSendMessage = (text) => {
    setMessages([...messages, { id: Date.now(), text }]);
  };

  const handleLogout = () => {
    authService.logout();
    setIsAuthenticated(false);
  };

  if (!isAuthenticated) {
    return <AuthPage onLogin={() => setIsAuthenticated(true)} />;
  }

  return (
    <div className="app-container">
      <Sidebar onAction={handleAction} onLogout={handleLogout} />
      <div className="main-chat">
        <AsciiFrame>
          {currentView === 'chat' ? (
            <>
              <ChatHeader onMenuClick={handleMenuClick} />
              <ChatHistory messages={messages} />
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
