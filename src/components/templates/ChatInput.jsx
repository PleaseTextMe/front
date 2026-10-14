import React, { useState } from 'react';
import { strings } from '../../config/strings.js';

function ChatInput({ onSendMessage, onTyping }) {
  const [inputValue, setInputValue] = useState('');
  const [sending, setSending] = useState(false);

  const send = async () => {
    if (sending || !inputValue.trim()) return;
    setSending(true);
    try {
      if (await onSendMessage(inputValue)) setInputValue('');
    } finally {
      setSending(false);
    }
  };

  // слушаем нажатие enter чтобы можно было отправлять сообщения без мышки
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && inputValue.trim() !== '') {
      e.preventDefault();
      send();
    }
  };

  return (
    <div className="chat-input-area">
      <div className="input-wrapper">
        <input 
          type="text" 
          value={inputValue}
          disabled={sending}
          onChange={(e) => {
            setInputValue(e.target.value);
            if (onTyping) onTyping();
          }}
          onKeyDown={handleKeyPress}
          placeholder={strings.input.prompt}
          autoFocus
        />
        <span className="block-cursor"></span>
      </div>
      <button onClick={send} disabled={sending}>{strings.input.submitButton}</button>
    </div>
  );
}

export default ChatInput;
