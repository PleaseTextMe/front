import React from 'react';

function ChatHistory({ messages }) {
  return (
    <div className="chat-history">
      {messages.map((msg) => (
        <div key={msg.id} className="message">
          {msg.text}
        </div>
      ))}
    </div>
  );
}

export default ChatHistory;
