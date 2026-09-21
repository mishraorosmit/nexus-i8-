import React, { useState } from 'react';
import { adminLogin } from '../api.ts';
import { Lock, AlertCircle, ArrowRight, Eye, EyeOff, ShieldCheck } from 'lucide-react';

interface AdminLoginPageProps {
  onLoginSuccess: () => void;
}

export const AdminLoginPage: React.FC<AdminLoginPageProps> = ({ onLoginSuccess }) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      setErrorMessage('Please enter the administrator password.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    const result = await adminLogin(password);

    if (result.success) {
      onLoginSuccess();
    } else {
      setErrorMessage(result.error || 'Authentication rejected. Please check your credentials.');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-neutral-950 text-neutral-100 flex flex-col justify-center items-center p-4 font-sans antialiased selection:bg-neutral-800">
      <div className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-xl p-8 shadow-2xl">
        {/* Header */}
        <div className="flex items-center space-x-3 mb-6 pb-6 border-b border-neutral-800">
          <div className="w-10 h-10 rounded-lg bg-neutral-800 border border-neutral-700 flex items-center justify-center text-neutral-300">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-white flex items-center gap-2">
              NEXUS Admin Portal
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-neutral-800 text-neutral-400 border border-neutral-700">
                Internal
              </span>
            </h1>
            <p className="text-xs text-neutral-400">Restricted administrative access</p>
          </div>
        </div>

        {/* Error notification */}
        {errorMessage && (
          <div
            id="admin-login-error"
            className="mb-6 p-3.5 rounded-lg bg-red-950/50 border border-red-800/60 text-red-200 text-xs flex items-start gap-2.5 leading-relaxed"
          >
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-red-300">Access Denied</p>
              <p className="text-red-400/90 mt-0.5">{errorMessage}</p>
            </div>
          </div>
        )}

        {/* One-Password Authentication Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label
              htmlFor="admin-password-input"
              className="block text-xs font-medium text-neutral-300 uppercase tracking-wider mb-2"
            >
              Master Password
            </label>
            <div className="relative">
              <input
                id="admin-password-input"
                name="admin_password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter administrator password..."
                disabled={isLoading}
                className="w-full bg-neutral-950 border border-neutral-700 focus:border-neutral-400 rounded-lg px-3.5 py-2.5 text-sm text-neutral-100 placeholder-neutral-500 focus:outline-none transition-colors pr-10"
              />
              <button
                type="button"
                id="toggle-password-visibility"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-200 transition-colors p-1"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[11px] text-neutral-500 mt-1.5 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
              Direct scrypt verification. Single administrator model.
            </p>
          </div>

          <button
            type="submit"
            id="admin-login-submit-button"
            disabled={isLoading}
            className="w-full bg-white hover:bg-neutral-200 text-neutral-950 font-medium py-2.5 px-4 rounded-lg text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-sm"
          >
            {isLoading ? (
              <span>Authenticating...</span>
            ) : (
              <>
                <span>LOGIN</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Security boundary note */}
        <div className="mt-8 pt-4 border-t border-neutral-800 text-center">
          <p className="text-[11px] text-neutral-500">
            Internal NEXUS operational interface. All actions are cryptographically logged to SQLite audit tables.
          </p>
        </div>
      </div>
    </div>
  );
};
