import { useState, useEffect } from 'react';

const STORAGE_KEY = 'dashboard_auth';

export default function PasscodeGate({ onAuthenticated }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState(false);
  const [shaking, setShaking] = useState(false);

  // Check persisted auth on mount
  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEY)) {
      onAuthenticated();
    }
  }, [onAuthenticated]);

  function handleSubmit(e) {
    e.preventDefault();

    if (code === import.meta.env.VITE_PASSCODE) {
      localStorage.setItem(STORAGE_KEY, 'true');
      onAuthenticated();
    } else {
      setError(true);
      setShaking(true);
      setTimeout(() => setShaking(false), 500);
      setTimeout(() => setError(false), 2500);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-cream-50 dark:bg-slate-950 relative overflow-hidden">
      {/* Faint noise texture overlay */}
      <div
        className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05] pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'repeat',
          backgroundSize: '256px 256px',
        }}
      />

      <form
        onSubmit={handleSubmit}
        className="relative z-10 flex flex-col items-center w-full max-w-xs px-4"
      >
        {/* Property heading */}
        <h1 className="font-display text-3xl font-semibold text-gray-900 dark:text-gray-100 mb-1 tracking-tight">
          2728 Partnership
        </h1>
        <p className="font-body text-sm text-gray-500 dark:text-gray-400 mb-10">
          Property Investment Dashboard
        </p>

        {/* Passcode input */}
        <input
          type="password"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Passcode"
          autoFocus
          className={[
            'w-full text-center text-lg font-mono tracking-widest py-3 px-4 rounded-lg',
            'bg-cream-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100',
            'border border-gray-300 dark:border-gray-700',
            'placeholder:text-gray-400 dark:placeholder:text-gray-600',
            'focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent',
            'transition-all',
            shaking ? 'animate-shake' : '',
          ].join(' ')}
        />

        {/* Error message */}
        <p
          className={[
            'text-sm mt-2 h-5 transition-opacity duration-200',
            error ? 'text-rose-500 opacity-100' : 'opacity-0',
          ].join(' ')}
        >
          Invalid passcode
        </p>

        {/* Submit button */}
        <button
          type="submit"
          className={[
            'w-full mt-2 py-3 rounded-lg font-body font-semibold text-sm tracking-wide',
            'bg-amber-400 text-slate-950',
            'hover:brightness-110 active:brightness-95',
            'transition-all cursor-pointer',
          ].join(' ')}
        >
          Enter
        </button>
      </form>

      {/* Shake keyframes injected via style tag */}
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          15% { transform: translateX(-6px); }
          30% { transform: translateX(5px); }
          45% { transform: translateX(-4px); }
          60% { transform: translateX(3px); }
          75% { transform: translateX(-2px); }
        }
        .animate-shake {
          animation: shake 0.4s ease-in-out;
        }
      `}</style>
    </div>
  );
}
