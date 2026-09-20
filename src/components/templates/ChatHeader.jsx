import React from 'react';
import { strings } from '../../config/strings.js';

function ChatHeader({ onMenuClick, contactName, statusText }) {
  return (
    <div className="chat-header">
      <div className="user-info">
        <h2>{strings.header.prefix}{(contactName || '---').toUpperCase()}</h2>
        <span>{strings.header.statusPrefix}{(statusText || strings.header.statusOffline).toUpperCase()}</span>
      </div>
      <div>
        <button onClick={onMenuClick}>{strings.header.menuButton}</button>
      </div>
    </div>
  );
}

export default ChatHeader;
