import React from 'react';
import { strings } from '../../config/strings.js';
import { authService } from '../../services/auth.js';
import AsciiFrame from './AsciiFrame.jsx';

function Sidebar({ onAction, onLogout }) {
  const users = strings.sidebar.usersList;
  const activeUser = users[0]; //из масива юзерлист в стрингах
  const session = authService.checkSession();
  const avatar = session?.avatar;

  return (
    <div className="sidebar">
      <AsciiFrame>
        <div style={{ marginBottom: '20px' }}>{strings.sidebar.title}</div>
        
        {avatar && (
          <div style={{ marginBottom: '20px', textAlign: 'center', border: '1px dashed #005500', padding: '5px' }}>
            <img src={avatar} alt="my avatar" style={{ maxWidth: '100%', maxHeight: '100px', objectFit: 'contain' }} />
          </div>
        )}

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '5px' }}>
          {users.map(u => (
            <div key={u} className="sidebar-user" onClick={() => onAction(u)}>
              {u === activeUser ? '> ' : '  '}{u.toUpperCase()}
            </div>
          ))}
        </div>
        {onLogout && (
          <div style={{ marginTop: '20px' }}>
            <button onClick={onLogout}>{strings.sidebar.logoutButton}</button>
          </div>
        )}
      </AsciiFrame>
    </div>
  );
}

export default Sidebar;
