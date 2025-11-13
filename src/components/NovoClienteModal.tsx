import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { FaTimes, FaUserPlus, FaStar, FaDollarSign, FaHeart, FaUser, FaPhone, FaEnvelope, FaMapMarkerAlt, FaStickyNote } from 'react-icons/fa';
import PinModal from '@/components/PinModal';

type Endereco = {
  rua?: string;
  numero?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  complemento?: string;
};

interface NovoClienteModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (c: { uuid: string; nick: string }) => void;
}

export default function NovoClienteModal({ open, onClose, onCreated }: NovoClienteModalProps) {
  const [nick, setNick] = React.useState('');
  const [nome, setNome] = React.useState('');
  const [genero, setGenero] = React.useState<'M'|'F'|'O'|''>('');
  const [telefone, setTelefone] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [endereco, setEndereco] = React.useState<Endereco>({});
  const [estrelas, setEstrelas] = React.useState<number>(0);
  const [gasto, setGasto] = React.useState<number>(0);
  const [simpatia, setSimpatia] = React.useState<number>(0);
  const [nota, setNota] = React.useState<string>('');
  const [pinOpen, setPinOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [err, setErr] = React.useState<string>('');
  const [fieldErr, setFieldErr] = React.useState<{ telefone?: string; email?: string; uf?: string }>({});

  const ANIMAIS = React.useMemo(() => ['Pantera','Lobo','Tigre','Falcao','Jaguar','Leao','Raposa','Urso','Aguia','Lince','Coruja','Antilope','Bufalo','Cavalo','Touro','Gaviao','Onca','Puma','Coelho','Veado'], []);
  const genUuid = React.useCallback(() => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let out = '';
    for (let i = 0; i < 6; i++) out += chars[Math.floor(Math.random() * chars.length)];
    return out;
  }, []);
  const genNick = React.useCallback(() => {
    const animal = ANIMAIS[Math.floor(Math.random() * ANIMAIS.length)] || 'Cliente';
    return `${animal}${genUuid()}`;
  }, [ANIMAIS, genUuid]);

  function onlyDigits(s: string): string { return s.replace(/\D/g, ''); }
  function formatTelefone(s: string): string {
    const d = onlyDigits(s).slice(0, 11);
    if (d.length <= 10) {
      // (00) 0000-0000
      const p1 = d.slice(0, 2);
      const p2 = d.slice(2, 6);
      const p3 = d.slice(6, 10);
      return [p1 ? `(${p1}` : '', p1 && p1.length === 2 ? ') ' : '', p2, p3 ? `-${p3}` : ''].join('');
    }
    // (00) 00000-0000
    const p1 = d.slice(0, 2);
    const p2 = d.slice(2, 7);
    const p3 = d.slice(7, 11);
    return [p1 ? `(${p1}` : '', p1 && p1.length === 2 ? ') ' : '', p2, p3 ? `-${p3}` : ''].join('');
  }
  function validateEmail(v: string): boolean { return !v || /.+@.+\..+/.test(v); }
  function validateUF(v?: string): boolean { return !v || /^[A-Z]{2}$/.test(v); }
  function validateForm(): boolean {
    const errs: { telefone?: string; email?: string; uf?: string } = {};
    const d = onlyDigits(telefone);
    if (telefone && (d.length < 10 || d.length > 11)) errs.telefone = 'Telefone inválido';
    if (!validateEmail(email)) errs.email = 'Email inválido';
    if (!validateUF(endereco.uf)) errs.uf = 'UF deve ter 2 letras';
    setFieldErr(errs);
    setErr('');
    return Object.keys(errs).length === 0;
  }

  React.useEffect(() => {
    if (!open) {
      setNick('');
      setNome('');
      setGenero('');
      setTelefone('');
      setEmail('');
      setEndereco({});
      setEstrelas(0);
      setGasto(0);
      setSimpatia(0);
      setNota('');
      setPinOpen(false);
      setLoading(false);
      setErr('');
      setFieldErr({});
    } else {
      // gerar nick automático Animal+UUID
      setNick(genNick());
    }
  }, [open, genNick]);

  async function submit(pin: string) {
    setLoading(true);
    try {
      // pin será validado no servidor; validações de formulário já feitas antes de abrir o PIN
      setErr('');
      const body = {
        nick: nick.trim(),
        nome: nome.trim() || undefined,
        genero: genero || undefined,
        telefone: telefone.replace(/\D/g,'') || undefined,
        email: email || undefined,
        endereco,
        estrelas,
        gasto,
        simpatia,
        compras: 0,
        nota,
        pin
      };
      const r = await fetch('/api/clientes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!r.ok) {
        // 403 -> PIN inválido: deixe o PinModal lidar (retorna false)
        if (r.status === 403) return false;
        let msg = 'Falha ao salvar cliente';
        try { const j = await r.json(); if (j?.error) msg = j.error; } catch {}
        setErr(msg);
        // Fecha o PinModal mas mantém este modal para correção
        return true;
      }
      const created = await r.json();
      onCreated({ uuid: created.uuid, nick: created.nick });
      return true;
    } catch {
      setErr('Sem conexão com o servidor');
      // Fecha PIN (para não mostrar mensagem incorreta), mantém modal aberto
      return true;
    } finally {
      setLoading(false);
    }
  }

  const disabled = !nick.trim();

  const renderStarRating = (value: number, onChange: (v: number) => void, color: string) => (
    <div className="flex items-center gap-1 mt-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          className={`text-xl transition-all duration-200 ${
            star <= value ? color : 'text-zinc-700'
          } hover:scale-110`}
        >
          {star <= value ? '★' : '☆'}
        </button>
      ))}
      <span className="text-xs text-zinc-500 ml-2">{value}/5</span>
    </div>
  );

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            className="relative w-full max-w-3xl max-h-[85vh] overflow-y-auto rounded-2xl border theme-border theme-surface shadow-2xl"
            initial={{ y: 32, scale: 0.95 }}
            animate={{ y: 0, scale: 1 }}
            exit={{ y: 32, scale: 0.95 }}
          >
            {/* Header */}
            <div className="sticky top-0 z-10 border-b theme-border theme-surface backdrop-blur-md px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                    <FaUserPlus className="text-emerald-400 text-lg" />
                  </div>
                  <div>
                    <h3 className="theme-text font-semibold text-lg">Novo Cliente</h3>
                    <p className="text-xs text-zinc-400">Preencha os dados do cliente</p>
                  </div>
                </div>
                <button
                  className="w-10 h-10 rounded-xl border theme-border theme-surface text-zinc-400 hover:opacity-90 hover:text-zinc-300 transition-all duration-200 flex items-center justify-center"
                  aria-label="Fechar"
                  onClick={onClose}
                >
                  <FaTimes />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {err && (
                <div className="px-3 py-2 rounded-lg border theme-border bg-rose-500/10 text-rose-300 text-sm">
                  {err}
                </div>
              )}
              {/* Informações Básicas */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-semibold theme-text pb-2 border-b theme-border">
                  <FaUser className="text-zinc-400" />
                  <span>Informações Básicas</span>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-zinc-400 mb-1.5">
                      Nick <span className="text-red-400">*</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        value={nick}
                        readOnly
                        placeholder="Gerado automaticamente"
                        className="flex-1 rounded-lg border theme-border theme-surface text-zinc-200 px-3 py-2.5 text-sm placeholder-zinc-500 outline-none"
                      />
                      <button type="button" onClick={()=> setNick(genNick())} className="px-2.5 py-2 rounded-lg border theme-border text-zinc-300 hover:opacity-90 text-xs">Gerar outro</button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                      Nome Completo
                    </label>
                    <input
                      value={nome}
                      onChange={(e) => setNome(e.target.value)}
                      placeholder="Nome completo do cliente"
                      className="w-full rounded-lg border theme-border theme-surface text-zinc-200 px-3 py-2.5 text-sm placeholder-zinc-500 outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                      Gênero
                    </label>
                    <select
                      value={genero}
                      onChange={(e) => setGenero(e.target.value as 'M'|'F'|'O'|'')}
                      className="w-full rounded-lg border theme-border theme-surface text-zinc-200 px-3 py-2.5 text-sm outline-none"
                    >
                      <option value="">Selecione</option>
                      <option value="M">Masculino</option>
                      <option value="F">Feminino</option>
                      <option value="O">Outro</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-zinc-400 mb-1.5 flex items-center gap-1">
                      <FaPhone className="text-[10px]" />
                      Telefone
                    </label>
                    <input
                      value={telefone}
                      onChange={(e) => setTelefone(formatTelefone(e.target.value))}
                      placeholder="(00) 00000-0000"
                      className="w-full rounded-lg border theme-border theme-surface text-zinc-200 px-3 py-2.5 text-sm placeholder-zinc-500 outline-none"
                    />
                    {fieldErr.telefone && <div className="text-[11px] text-rose-400 mt-1">{fieldErr.telefone}</div>}
                  </div>
                  <div>
                    <label className="text-xs font-medium text-zinc-400 mb-1.5 flex items-center gap-1">
                      <FaEnvelope className="text-[10px]" />
                      Email
                    </label>
                    <input
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="email@exemplo.com"
                      type="email"
                      className="w-full rounded-lg border theme-border theme-surface text-zinc-200 px-3 py-2.5 text-sm placeholder-zinc-500 outline-none"
                    />
                    {fieldErr.email && <div className="text-[11px] text-rose-400 mt-1">{fieldErr.email}</div>}
                  </div>
                </div>
              </div>

              {/* Endereço */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-semibold theme-text pb-2 border-b theme-border">
                  <FaMapMarkerAlt className="text-zinc-400" />
                  <span>Endereço</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-zinc-400 mb-1.5">Rua</label>
                    <input
                      value={endereco.rua || ''}
                      onChange={(e) => setEndereco((prev) => ({ ...prev, rua: e.target.value }))}
                      placeholder="Nome da rua"
                      className="w-full rounded-lg border theme-border theme-surface text-zinc-200 px-3 py-2.5 text-sm placeholder-zinc-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-1.5">Número</label>
                    <input
                      value={endereco.numero || ''}
                      onChange={(e) => setEndereco((prev) => ({ ...prev, numero: e.target.value }))}
                      placeholder="123"
                      className="w-full rounded-lg border theme-border theme-surface text-zinc-200 px-3 py-2.5 text-sm placeholder-zinc-500 outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-1.5">Bairro</label>
                    <input
                      value={endereco.bairro || ''}
                      onChange={(e) => setEndereco((prev) => ({ ...prev, bairro: e.target.value }))}
                      placeholder="Centro"
                      className="w-full rounded-lg border theme-border theme-surface text-zinc-200 px-3 py-2.5 text-sm placeholder-zinc-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-1.5">Cidade</label>
                    <input
                      value={endereco.cidade || ''}
                      onChange={(e) => setEndereco((prev) => ({ ...prev, cidade: e.target.value }))}
                      placeholder="São Paulo"
                      className="w-full rounded-lg border theme-border theme-surface text-zinc-200 px-3 py-2.5 text-sm placeholder-zinc-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-1.5">UF</label>
                    <input
                      value={endereco.uf || ''}
                      onChange={(e) => {
                        const v = e.target.value.toUpperCase().slice(0,2);
                        setEndereco((prev) => ({ ...prev, uf: v }));
                        setFieldErr((fe) => ({ ...fe, uf: validateUF(v) ? undefined : 'UF deve ter 2 letras' }));
                      }}
                      placeholder="SP"
                      maxLength={2}
                      className="w-full rounded-lg border theme-border theme-surface text-zinc-200 px-3 py-2.5 text-sm placeholder-zinc-500 outline-none uppercase"
                    />
                    {fieldErr.uf && <div className="text-[11px] text-rose-400 mt-1">{fieldErr.uf}</div>}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* CEP removido */}
                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-1.5">Complemento</label>
                    <input
                      value={endereco.complemento || ''}
                      onChange={(e) => setEndereco((prev) => ({ ...prev, complemento: e.target.value }))}
                      placeholder="Apto 101, Bloco A"
                      className="w-full rounded-lg border theme-border theme-surface text-zinc-200 px-3 py-2.5 text-sm placeholder-zinc-500 outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Avaliações */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-semibold theme-text pb-2 border-b theme-border">
                  <FaStar className="text-zinc-400" />
                  <span>Avaliações</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                  <div className="p-4 rounded-xl theme-surface border theme-border">
                    <label className="text-xs font-medium text-zinc-400 mb-1 flex items-center gap-1.5">
                      <FaStar className="text-yellow-400" />
                      Qualidade
                    </label>
                    {renderStarRating(estrelas, setEstrelas, 'text-yellow-400')}
                  </div>
                  
                  <div className="p-4 rounded-xl theme-surface border theme-border">
                    <label className="text-xs font-medium text-zinc-400 mb-1 flex items-center gap-1.5">
                      <FaDollarSign className="text-emerald-400" />
                      Gasto
                    </label>
                    {renderStarRating(gasto, setGasto, 'text-emerald-400')}
                  </div>
                  
                  <div className="p-4 rounded-xl theme-surface border theme-border">
                    <label className="text-xs font-medium text-zinc-400 mb-1 flex items-center gap-1.5">
                      <FaHeart className="text-pink-400" />
                      Simpatia
                    </label>
                    {renderStarRating(simpatia, setSimpatia, 'text-pink-400')}
                  </div>
                </div>
              </div>

              {/* Observações */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-semibold theme-text pb-2 border-b theme-border">
                  <FaStickyNote className="text-zinc-400" />
                  <span>Observações</span>
                </div>
                
                <div>
                  <textarea
                    value={nota}
                    onChange={(e) => setNota(e.target.value)}
                    placeholder="Adicione observações sobre o cliente..."
                    rows={4}
                    className="w-full rounded-lg border theme-border theme-surface text-zinc-200 px-3 py-2.5 text-sm placeholder-zinc-500 outline-none resize-none"
                  />
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 border-t theme-border theme-surface backdrop-blur-md px-6 py-4 flex items-center justify-end gap-3">
              <button
                className="px-4 py-2.5 rounded-lg border theme-border text-zinc-300 hover:opacity-90 transition-all duration-200 font-medium"
                onClick={onClose}
              >
                Cancelar
              </button>
              <button
                disabled={disabled || loading}
                className="px-5 py-2.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 transition-all duration-200 font-medium shadow-lg shadow-emerald-500/20"
                onClick={() => { if (validateForm()) setPinOpen(true); }}
              >
                {loading ? 'Salvando...' : 'Salvar Cliente'}
              </button>
            </div>
          </motion.div>

          <PinModal
            open={pinOpen}
            title="Confirmar criação"
            onClose={() => setPinOpen(false)}
            onConfirm={submit}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
