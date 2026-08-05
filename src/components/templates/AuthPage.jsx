import React, { useState } from 'react';
import { strings } from '../../config/strings.js';
import { authService } from '../../services/auth.js';
import AsciiFrame from './AsciiFrame.jsx';

function AuthPage({ onLogin }) {
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [registerStep, setRegisterStep] = useState(1); // 1: email, 2: code, 3: details
  
  // стейты
  const [email, setEmail] = useState('');
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');

  // 2fa стейты
  const [verificationCode, setVerificationCode] = useState('');
  const [verifyToken, setVerifyToken] = useState('');
  
  // индикаторы загрузки
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // логин
    if (!isRegisterMode) {
      setIsLoading(true);
      const success = await authService.login(email, password);
      setIsLoading(false);
      
      if (success) {
        onLogin();
      } else {
        setError(strings.auth.errorInvalidData);
      }
      return;
    }

    // регистрация: шаг 3 (финал)
    if (registerStep === 3) {
      if (password !== confirmPassword) {
        setError(strings.auth.errorPasswordsNotMatch);
        return;
      }
      
      setIsLoading(true);
      const success = await authService.register(email, login, password, verifyToken);
      setIsLoading(false);
      
      if (success) {
        onLogin();
      } else {
        setError(strings.auth.errorUserExists);
      }
    }
  };

  const handleGetCode = async () => {
    if (!email) return;
    setError('');
    setIsLoading(true);
    const res = await authService.requestCode(email);
    setIsLoading(false);
    
    if (res.success) {
      setVerifyToken(res.verifyToken);
      setRegisterStep(2);
    } else {
      if (res.error === 'User already exists') {
        setError(strings.auth.errorUserExists);
      } else {
        setError(strings.auth.errorInvalidData || 'error sending code');
      }
    }
  };

  const handleVerifyCode = async () => {
    setError('');
    setIsLoading(true);
    const result = await authService.verifyCode(email, verificationCode, verifyToken);
    setIsLoading(false);

    if (result.success) {
      setRegisterStep(3);
      console.log('[system] email verified. starting background key generation while user types password...');
    } else {
      if (result.error === 'User already exists') {
        setError(strings.auth.errorUserExists);
      } else {
        setError(strings.auth.errorInvalidCode);
      }
    }
  };

  const toggleMode = () => {
    setIsRegisterMode(!isRegisterMode);
    setRegisterStep(1);
    setError('');
  };

  const logo = `
   _____ _    _  ___ _____ 
  / ____| |  | |/ _ \\_   _|
 | |    | |__| | |_| || |  
 | |    |  __  |  _  || |  
 | |____| |  | | | | || |_ 
  \\_____|_|  |_|_| |_|_____|
  `;

  return (
    <div className="auth-container">
      <div className="auth-box-wrapper">
        <AsciiFrame>
          <div className="ascii-logo glitch" data-text={strings.auth.title}>{logo}</div>
          <div style={{ textAlign: 'center', marginBottom: '20px' }}>
            {isRegisterMode ? strings.auth.registerTitle : strings.auth.title}
          </div>
          
          {error && <div style={{ color: '#ff0000', marginBottom: '15px', textAlign: 'center' }}>{error}</div>}
          
          <form onSubmit={handleSubmit} className="auth-form">
            
            {/* РЕЖИМ ЛОГИНА */}
            {!isRegisterMode && (
              <>
                <div className="auth-input-row">
                  <div className="input-wrapper">
                    <input 
                      type="email" 
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={strings.auth.emailPlaceholder || "Email"}
                      required
                    />
                  </div>
                </div>
                <div className="auth-input-row">
                  <div className="input-wrapper">
                    <input 
                      type="password" 
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={strings.auth.passwordPlaceholder}
                      required
                    />
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', marginTop: '20px' }}>
                  <button type="submit" disabled={isLoading}>
                    {isLoading ? '...' : strings.auth.submitButton}
                  </button>
                  <button type="button" onClick={toggleMode}>{strings.auth.toRegisterText}</button>
                </div>
              </>
            )}

            {/* РЕЖИМ РЕГИСТРАЦИИ (WIZARD) */}
            {isRegisterMode && (
              <>
                {/* ШАГ 1: Почта */}
                {registerStep === 1 && (
                  <>
                    <div className="auth-input-row">
                      <div className="input-wrapper">
                        <input 
                          type="email" 
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder={strings.auth.emailPlaceholder}
                          required
                          autoFocus
                        />
                      </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', marginTop: '20px' }}>
                      <button type="button" onClick={handleGetCode} disabled={isLoading || !email}>
                        {isLoading ? '...' : strings.auth.getCodeButton}
                      </button>
                      <button type="button" onClick={toggleMode}>{strings.auth.toLoginText}</button>
                    </div>
                  </>
                )}

                {/* ШАГ 2: Код (с анимацией сканирования) */}
                {registerStep === 2 && (
                  <div className="scanline-container" style={{ padding: '10px 0' }}>
                    <div className="scanline"></div>
                    <div style={{ textAlign: 'center', marginBottom: '20px', color: '#ffb000' }}>
                      {strings.auth.verificationSubtitle}
                    </div>
                    <div className="auth-input-row">
                      <div className="input-wrapper">
                        <input 
                          type="text" 
                          value={verificationCode}
                          onChange={(e) => setVerificationCode(e.target.value)}
                          placeholder={strings.auth.verificationPlaceholder}
                          required
                          autoFocus
                          maxLength={6}
                          style={{ textAlign: 'center', letterSpacing: '5px' }}
                        />
                      </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', marginTop: '20px' }}>
                      <button type="button" onClick={handleVerifyCode} disabled={isLoading || verificationCode.length < 6}>
                        {isLoading ? '...' : strings.auth.verifySubmitButton}
                      </button>
                      <button type="button" onClick={() => setRegisterStep(1)}>
                        [ CANCEL ]
                      </button>
                    </div>
                  </div>
                )}

                {/* ШАГ 3: Пароли и логин */}
                {registerStep === 3 && (
                  <>
                    <div style={{ textAlign: 'center', marginBottom: '15px', color: '#00aa00' }}>
                      {strings.auth.emailVerifiedText}
                    </div>
                    <div className="auth-input-row">
                      <div className="input-wrapper">
                        <input 
                          type="text" 
                          value={login}
                          onChange={(e) => setLogin(e.target.value)}
                          placeholder={strings.auth.loginPlaceholder}
                          required
                          autoFocus
                        />
                      </div>
                    </div>
                    <div className="auth-input-row">
                      <div className="input-wrapper">
                        <input 
                          type="password" 
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder={strings.auth.passwordPlaceholder}
                          required
                        />
                      </div>
                    </div>
                    <div className="auth-input-row">
                      <div className="input-wrapper">
                        <input 
                          type="password" 
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder={strings.auth.confirmPasswordPlaceholder}
                          required
                        />
                      </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', marginTop: '20px' }}>
                      <button type="submit" disabled={isLoading}>
                        {isLoading ? '...' : strings.auth.registerSubmitButton}
                      </button>
                    </div>
                  </>
                )}
              </>
            )}
          </form>
        </AsciiFrame>
      </div>
    </div>
  );
}

export default AuthPage;
