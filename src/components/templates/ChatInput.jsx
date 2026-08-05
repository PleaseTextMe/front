import React, { useState } from 'react';
import { strings } from '../../config/strings.js';

function ChatInput({ onSendMessage }) {
  const [inputValue, setInputValue] = useState('');

  // слушаем нажатие enter чтобы можно было отправлять сообщения без мышки
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && inputValue.trim() !== '') {
      onSendMessage(inputValue);
      setInputValue('');
    }
  };

  return (
    <div className="chat-input-area">
      <div className="input-wrapper">
        <input 
          type="text" 
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyPress}
          placeholder={strings.input.prompt}
          autoFocus
        />
        <span className="block-cursor"></span>
      </div>
      <button onClick={() => {
        if (inputValue.trim() !== '') {
          onSendMessage(inputValue);
          setInputValue('');
        }
      }}>{strings.input.submitButton}</button>
    </div>
  );
}

export default ChatInput;
