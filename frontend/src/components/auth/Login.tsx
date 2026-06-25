import React, { useState } from 'react';
import { Mail, Lock, LogIn, AlertCircle } from 'lucide-react';
import client from '../../api/client';
import { User } from '../../types';

interface LoginProps {
  onLoginSuccess: (token: string, user: User) => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please fill in all fields.');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      const response = await client.post('/auth/login', { email, password });
      const { access_token, user } = response.data;
      onLoginSuccess(access_token, user);
    } catch (err: any) {
      console.error(err);
      setError(
        err.response?.data?.detail || 'Invalid email or password. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative bg-[#f2f2f7]">
      {/* Floating Card */}
      <div className="glass-panel w-full max-w-md p-8 rounded-3xl animate-slide-up relative overflow-hidden">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-black/5 border border-black/10 flex items-center justify-center text-3xl mx-auto mb-4 shadow-glass">
            🧠
          </div>
          <h2 className="text-2xl font-extrabold tracking-tight text-[#1c1c1e] mb-2 font-sans">
            Welcome Back
          </h2>
          <p className="text-sm text-[#8e8e93]">
            Sign in to access your RAG workspace
          </p>
        </div>

        {/* Errors display */}
        {error && (
          <div className="flex items-start gap-3 bg-danger/10 border border-danger/20 text-danger text-sm rounded-xl p-4 mb-6 animate-fade-in">
            <AlertCircle size={18} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-1 text-left">
            <label className="text-xs font-semibold text-[#8e8e93] tracking-wide uppercase">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="email"
                placeholder="name@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                className="w-full glass-input !pl-10"
                required
              />
            </div>
          </div>

          <div className="space-y-1 text-left">
            <label className="text-xs font-semibold text-[#8e8e93] tracking-wide uppercase">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                className="w-full glass-input !pl-10"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full btn-primary-glow text-white py-3.5 px-4 rounded-xl font-bold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-55 disabled:cursor-not-allowed text-sm"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <LogIn size={18} />
                <span>Sign In</span>
              </>
            )}
          </button>
        </form>

        {/* Quick test credentials seed details footer */}
        <div className="mt-8 text-center border-t border-black/5 pt-6 text-[11px] text-[#8e8e93]">
          <p className="font-semibold text-[#8e8e93] mb-1">Developer Accounts:</p>
          <p>Admin: <span className="text-[#1c1c1e]">admin@company.com</span> / <span className="text-[#1c1c1e]">adminpassword</span></p>
          <p>Agent: <span className="text-[#1c1c1e]">agent@company.com</span> / <span className="text-[#1c1c1e]">agentpassword</span></p>
        </div>
      </div>
    </div>
  );
}
