import { useState } from 'react';
import { signIn } from 'next-auth/react';

export default function AuthPage() {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{4}$/.test(pin)) {
      setError('PIN deve ter 4 dígitos.');
      return;
    }
    setError('');
    await signIn('credentials', { pin, callbackUrl: '/dashboard' });
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900">
      <form onSubmit={handleSubmit} className="bg-gray-800 p-8 rounded shadow-md w-80">
        <h1 className="text-2xl font-bold text-center text-white mb-6">Login PDV Burguer</h1>
        <input
          type="password"
          maxLength={4}
          pattern="\d{4}"
          value={pin}
          onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
          className="w-full p-3 mb-4 rounded bg-gray-700 text-white text-center text-xl tracking-widest"
          placeholder="PIN (4 dígitos)"
        />
        {error && <p className="text-red-500 text-sm mb-2">{error}</p>}
        <button
          type="submit"
          className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-2 rounded transition"
        >
          Entrar
        </button>
      </form>
    </div>
  );
}
