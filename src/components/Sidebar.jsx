import React from 'react';
import { strings } from '../config/strings';

function Sidebar({ onAction, onLogout }) {
  return (
    <div className="sidebar">
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '15px' }}>
        <button onClick={() => onAction(strings.sidebar.button1)}>{strings.sidebar.button1}</button>
        <button onClick={() => onAction(strings.sidebar.button2)}>{strings.sidebar.button2}</button>
        <button onClick={() => onAction(strings.sidebar.button3)}>{strings.sidebar.button3}</button>
      </div>
      {onLogout && (
        <button onClick={onLogout} style={{ borderColor: '#ff6b6b', color: '#ff6b6b' }}>
          {strings.sidebar.logoutButton}
        </button>
      )}
    </div>
  );
}

export default Sidebar;
