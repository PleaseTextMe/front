import React, { useState } from 'react';
import { strings } from '../config/strings';
import { authService } from '../services/auth';

function AuthPage({ onLogin }) {
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [email, setEmail] = useState('');
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    
    if (isRegisterMode) {
      if (password !== confirmPassword) {
        setError(strings.auth.errorPasswordsNotMatch);
        return;
      }
      if (authService.register(email, login, password)) {
        onLogin();
      } else {
        setError(strings.auth.errorUserExists);
      }
    } else {
      if (authService.login(login, password)) {
        onLogin();
      } else {
        setError(strings.auth.errorInvalidData);
      }
    }
  };

  const toggleMode = () => {
    setIsRegisterMode(!isRegisterMode);
    setError('');
  };

  return (
    <div className="auth-container">
      <div className="auth-box">
        <h2>{isRegisterMode ? strings.auth.registerTitle : strings.auth.title}</h2>
        {error && <div style={{ color: '#ff6b6b', marginBottom: '15px', textAlign: 'center' }}>{error}</div>}
        <form onSubmit={handleSubmit} className="auth-form">
          {isRegisterMode && (
            <div className="input-wrapper auth-input">
              <input 
                type="email" 
                placeholder={strings.auth.emailPlaceholder} 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          )}
          <div className="input-wrapper auth-input">
            <input 
              type="text" 
              placeholder={strings.auth.loginPlaceholder} 
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              required
            />
          </div>
          <div className="input-wrapper auth-input">
            <input 
              type="password" 
              placeholder={strings.auth.passwordPlaceholder} 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {isRegisterMode && (
            <div className="input-wrapper auth-input">
              <input 
                type="password" 
                placeholder="Подтвердите пароль" 
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>
          )}
          <button type="submit" className="auth-submit-btn">
            {isRegisterMode ? strings.auth.registerSubmitButton : strings.auth.submitButton}
          </button>
          <div className="auth-toggle" onClick={toggleMode}>
            {isRegisterMode ? strings.auth.toLoginText : strings.auth.toRegisterText}
          </div>
        </form>
      </div>
    </div>
  );
}

export default AuthPage;
