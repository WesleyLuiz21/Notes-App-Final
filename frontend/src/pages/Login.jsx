import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../components/AuthContext';
import { api } from '../api/client';
import './Login.css';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSetup, setIsSetup] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (isSetup) {
        await api.setup(username, password);
        await login(username, password);
      } else {
        await login(username, password);
      }
      navigate('/notes');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">📝</div>
        <h1>{isSetup ? 'Create Account' : 'Sign In'}</h1>
        <p className="login-subtitle">
          {isSetup ? 'Set up your personal notes' : 'Welcome back'}
        </p>
        
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Username</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              autoComplete="username"
              required
            />
          </div>
          <div className="field">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete={isSetup ? 'new-password' : 'current-password'}
              required
            />
          </div>
          
          {error && <div className="error-msg">{error}</div>}
          
          <button type="submit" className="btn btn-primary login-btn" disabled={loading}>
            {loading ? 'Please wait…' : (isSetup ? 'Create & Sign In' : 'Sign In')}
          </button>
        </form>
        
        <button className="setup-toggle" onClick={() => { setIsSetup(!isSetup); setError(''); }}>
          {isSetup ? 'Already have an account? Sign in' : 'First time? Create account'}
        </button>
      </div>
    </div>
  );
}
