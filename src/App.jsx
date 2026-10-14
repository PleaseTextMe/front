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
import { messageService, getMessagesWebSocketUrl } from './services/messageService.js';

const AUTH_API_BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1').replace(/\/$/, '');

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentView, setCurrentView] = useState('chat'); // 'chat' | 'profile'
  
  const [contacts, setContacts] = useState([]);
  const [activeContact, setActiveContact] = useState(null);
  const [messages, setMessages] = useState({}); // { 'contactLogin': [...] }
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const [typingUsers, setTypingUsers] = useState({});
  const [sendError, setSendError] = useState('');

  useEffect(() => {
    if (authService.checkSession()) {
      setIsAuthenticated(true);
      fetchUsers();
    }
  }, []);

  const fetchUsers = async () => {
    const session = authService.checkSession();
    if (!session) return;
    try {
      const response = await fetch(`${AUTH_API_BASE}/users/`);
      if (response.ok) {
        const users = await response.json();
        const usernames = users.map(u => u.username).filter(u => u !== session.login);
        setContacts(usernames);
        if (usernames.length > 0 && !activeContact) {
          setActiveContact(usernames[0]);
        }
      } else {
        console.error('failed to fetch users:', response.status);
      }
    } catch (err) {
      console.error('error fetching users:', err);
    }
  };

  const wsRef = React.useRef(null);
  const historyLoadsRef = React.useRef({});

  // Загрузка сообщений при смене активного контакта
  useEffect(() => {
    if (isAuthenticated && activeContact) {
      loadMessages(activeContact);
    }
  }, [isAuthenticated, activeContact]);

  // Глобальное WebSocket подключение для реалтайм обновлений
  useEffect(() => {
    if (!isAuthenticated) return;
    const session = authService.checkSession();
    if (!session) return;

    let disposed = false;
    let reconnectTimer;
    let ws;
    const connect = () => {
      if (disposed) return;
      ws = new WebSocket(getMessagesWebSocketUrl(session.token));
      wsRef.current = ws;
    
      ws.onopen = () => console.log("[ws] connected");
      ws.onmessage = (event) => {
        if (disposed) return;
        let msg;
        try { msg = JSON.parse(event.data); } catch { return; }
        if (!msg || typeof msg !== 'object') return;
      
        if (msg.type === "presence") {
          setOnlineUsers(prev => {
            const newSet = new Set(prev);
            if (msg.status === "online") newSet.add(msg.login);
            else newSet.delete(msg.login);
            return newSet;
          });
          return;
        }
        if (msg.type === "sync_presence") {
          setOnlineUsers(new Set(msg.online_users));
          return;
        }
        if (msg.type === "typing") {
          setTypingUsers(prev => ({ ...prev, [msg.sender]: true }));
          setTimeout(() => {
            setTypingUsers(prev => ({ ...prev, [msg.sender]: false }));
          }, 3000);
          return;
        }

        // Если пришло сообщение, обновляем чат с нужным контактом
        const contactToUpdate = msg.sender_login === session.login ? msg.recipient_login : msg.sender_login;
      
        if (contactToUpdate) loadMessages(contactToUpdate);
      };
    
      ws.onclose = (event) => {
        console.log("[ws] disconnected");
        if (wsRef.current === ws) wsRef.current = null;
        if (disposed) return;
        setOnlineUsers(new Set());
        if (authService.checkSession()?.token === session.token && event.code !== 1008) {
          reconnectTimer = setTimeout(connect, 2000);
        }
      };
    };
    connect();

    return () => {
      disposed = true;
      clearTimeout(reconnectTimer);
      ws?.close();
    };
  }, [isAuthenticated]);

  const loadMessages = async (contact) => {
    const token = authService.checkSession()?.token;
    const request = (historyLoadsRef.current[contact] || 0) + 1;
    historyLoadsRef.current[contact] = request;
    const chatHistory = await messageService.getMessages(contact);
    if (!token || authService.checkSession()?.token !== token) return;
    if (historyLoadsRef.current[contact] !== request) return;
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
    if (!activeContact) return false;
    
    // Временно рисуем у себя в UI (оптимистично)
    const tempId = Date.now().toString();
    const session = authService.checkSession();
    if (!session) return false;
    setSendError('');
    const contact = activeContact;
    const optimisticMsg = { id: tempId, text, sender: session.login, timestamp: Math.floor(Date.now() / 1000) };
    
    setMessages(prev => ({
      ...prev,
      [activeContact]: [...(prev[activeContact] || []), optimisticMsg]
    }));

    // Send the encrypted message.
    const sent = await messageService.sendMessage(contact, text);
    if (authService.checkSession()?.token !== session.token) return false;
    if (!sent) {
      setMessages(prev => ({ ...prev, [contact]: (prev[contact] || []).filter(m => m.id !== tempId) }));
      setSendError('Не удалось отправить сообщение. Проверьте подключение и ключи получателя.');
      return false;
    }
    
    // Перезагружаем сообщения чтобы получить правильный ID и сохраненный стейт
    await loadMessages(contact);
    return true;
  };

  const handleTyping = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && activeContact) {
      wsRef.current.send(JSON.stringify({
        type: "typing",
        recipient_login: activeContact
      }));
    }
  };

  const handleLogout = () => {
    authService.logout();
    setIsAuthenticated(false);
    setMessages({});
    setContacts([]);
    setActiveContact(null);
    setOnlineUsers(new Set());
    setTypingUsers({});
    setSendError('');
  };

  if (!isAuthenticated) {
    return <AuthPage onLogin={() => {
      setIsAuthenticated(true);
      window.location.reload(); // Перезагружаем, чтобы useEffect отработал чисто
    }} />;
  }

  const currentMessages = activeContact ? (messages[activeContact] || []) : [];
  
  const isOnline = activeContact ? Array.from(onlineUsers).some(u => u.toLowerCase() === activeContact.toLowerCase()) : false;
  const isTyping = activeContact ? Object.keys(typingUsers).some(u => u.toLowerCase() === activeContact.toLowerCase() && typingUsers[u]) : false;
  
  const statusText = isTyping ? strings.header.statusTyping : (isOnline ? strings.header.statusOnline : strings.header.statusOffline);

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
              <ChatHeader onMenuClick={handleMenuClick} contactName={activeContact} statusText={statusText} />
              <ChatHistory messages={currentMessages} />
              {sendError && <div role="alert" style={{ color: '#ff5555', padding: '10px' }}>{sendError}</div>}
              <ChatInput onSendMessage={handleSendMessage} onTyping={handleTyping} />
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
