import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import ChatHeader from './components/ChatHeader';
import ChatHistory from './components/ChatHistory';
import ChatInput from './components/ChatInput';
import AuthPage from './components/AuthPage';
import { strings } from './config/strings';
import { authService } from './services/auth';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    if (authService.checkSession()) {
      setIsAuthenticated(true);
    }
  }, []);

  const handleAction = (type) => {
    console.log(`${strings.logs.actionSelected} ${type}`);
  };

  const handleSendMessage = (text) => {
    console.log(`${strings.logs.messageSent} ${text}`);
    setMessages([...messages, { id: Date.now(), text }]);
  };

  const handleAttachFile = () => {
    console.log(strings.logs.attachmentClicked);
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
        <ChatHeader />
        <ChatHistory messages={messages} />
        <ChatInput onSendMessage={handleSendMessage} onAttachFile={handleAttachFile} />
      </div>
    </div>
  );
}

export default App;
