import React, { useEffect, useRef } from 'react';
import { strings } from '../../config/strings.js';

function ChatHistory({ messages }) {
  // реф для автоскролла вниз при каждом новом сообщении
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="chat-history">
      <div className="message">
        <span className="timestamp">[00:00]</span>
        <span className="username">{strings.chat.systemUser}</span>
        <span>{strings.chat.connectionMsg}</span>
      </div>
      {messages.map((msg) => {
        const time = new Date(msg.timestamp * 1000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        return (
          <div key={msg.id} className="message">
            <span className="timestamp">[{time}]</span>
            <span className="username">&lt;{msg.sender}&gt;:</span>
            <span> {msg.text}</span>
          </div>
        );
      })}
      <div ref={endRef} />
    </div>
  );
}

export default ChatHistory;
