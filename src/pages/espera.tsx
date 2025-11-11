import React from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/router';
import { FaHourglassHalf, FaSignOutAlt } from 'react-icons/fa';

export default function EsperaPage() {
  const { data: session, status } = useSession({ required: true, onUnauthenticated() { if (typeof window !== 'undefined') window.location.href = '/'; } });
  const router = useRouter();
  React.useEffect(() => {
    if (status !== 'authenticated') return;
    const st = (session?.user as { status?: number } | undefined)?.status ?? 1;
    if (st === 1) router.replace('/dashboard');
  }, [status, session, router]);
  const access = (session?.user as { access?: string } | undefined)?.access || '';
  if (status !== 'authenticated') return null;
  return (
    <div className="min-h-screen app-gradient-bg flex items-center justify-center p-6">
      <div className="theme-surface theme-border border rounded-2xl p-8 w-full max-w-lg text-center">
        <div className="flex items-center justify-center mb-4">
          <FaHourglassHalf className="text-3xl text-amber-400" />
        </div>
        <h1 className="text-white text-xl font-semibold mb-2">Aguardando ativação</h1>
        <p className="text-zinc-400 text-sm mb-6">Sua conta está com status de novo e aguarda ativação por um administrador. Enquanto isso, você pode encerrar a sessão.</p>
        <button className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg border border-red-600 text-red-400 hover:bg-red-600/10" onClick={async ()=> { try { await fetch('/api/logs', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ access, action: 101, desc: 'logout' })}); } catch {}; signOut({ callbackUrl: '/' }); }}>
          <FaSignOutAlt />
          Sair
        </button>
      </div>
    </div>
  );
}
