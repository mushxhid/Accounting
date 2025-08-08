import React, { useState } from 'react';
import { signInWithGoogle } from '../utils/auth';
import { LogIn } from 'lucide-react';

const Login: React.FC = () => {
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    try {
      setLoading(true);
      setError('');
      await signInWithGoogle();
    } catch (e: any) {
      setError(e?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        <h1 className="text-2xl font-bold text-gray-900 text-center">Sign in</h1>
        <p className="text-gray-600 text-center mt-2">Only approved Google accounts can access.</p>
        {error && <p className="mt-4 text-sm text-danger-600 text-center">{error}</p>}
        <button onClick={handleLogin} disabled={loading} className="btn-primary w-full mt-6 flex items-center justify-center">
          <LogIn size={18} className="mr-2" />
          {loading ? 'Signing in...' : 'Sign in with Google'}
        </button>
      </div>
    </div>
  );
};

export default Login;


