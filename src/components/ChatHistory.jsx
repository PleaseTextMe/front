import React from 'react';

function ChatHistory({ messages }) {
  return (
    <div className="chat-history">
      {messages.map((msg) => (
        <div key={msg.id} className="message">
          {msg.text}
        </div>
      ))}
      <div className="sparkle">
        <svg viewBox="0 0 24 24">
          <path d="M12 2L15 9L22 12L15 15L12 22L9 15L2 12L9 9L12 2Z"/>
        </svg>
      </div>
    </div>
  );
}

export default ChatHistory;
