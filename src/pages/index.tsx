import { useRef, useState, useEffect } from "react";
import { useRouter } from "next/router";
import { signIn, useSession } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import { FaLock, FaShieldAlt, FaCheckCircle, FaTimesCircle } from "react-icons/fa";

export default function Home() {
  const [pin, setPin] = useState(["", "", "", ""]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [timer, setTimer] = useState(0);
  const [shake, setShake] = useState(false);
  const router = useRouter();
  const { status } = useSession();
  const inputsRef = useRef<Array<HTMLInputElement | null>>([null, null, null, null]);
  const formRef = useRef<HTMLFormElement>(null);

  // Redireciona quando autenticado
  useEffect(() => {
    if (status === "authenticated" && router.pathname !== "/dashboard") {
      router.replace("/dashboard");
    }
  }, [status, router]);

  // Foca no primeiro input ao carregar
  useEffect(() => {
    if (!blocked) {
      inputsRef.current[0]?.focus();
    }
  }, [blocked]);

  const handleChange = (idx: number, value: string) => {
    if (blocked) return;
    if (!/^[0-9]?$/.test(value)) return;
    
    const newPin = [...pin];
    newPin[idx] = value;
    setPin(newPin);
    setError("");
    
    // Avança para o próximo input
    if (value && idx < 3) {
      inputsRef.current[idx + 1]?.focus();
    }
    
    // Volta para o anterior se apagar
    if (!value && idx > 0) {
      inputsRef.current[idx - 1]?.focus();
    }
  };

  const handleKeyDown = (
    idx: number,
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (blocked) return;
    
    // Backspace no input vazio volta para o anterior
    if (e.key === "Backspace" && !pin[idx] && idx > 0) {
      inputsRef.current[idx - 1]?.focus();
    }
    
    // Enter submete o formulário
    if (e.key === "Enter" && pin.every(d => d !== "")) {
      formRef.current?.requestSubmit();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 4);
    const newPin = [...pin];
    
    for (let i = 0; i < pastedData.length; i++) {
      newPin[i] = pastedData[i];
    }
    
    setPin(newPin);
    
    // Foca no último input preenchido ou no próximo vazio
    const nextEmptyIndex = newPin.findIndex(d => d === "");
    if (nextEmptyIndex !== -1) {
      inputsRef.current[nextEmptyIndex]?.focus();
    } else {
      inputsRef.current[3]?.focus();
    }
  };

  const playSound = (type: 'success' | 'error') => {
    if (typeof window !== "undefined") {
      type WinAudio = Window & { webkitAudioContext?: typeof AudioContext; AudioContext?: typeof AudioContext };
      const AudioCtx = (window as WinAudio).AudioContext || (window as WinAudio).webkitAudioContext;
      if (!AudioCtx) return;
      const audioContext = new AudioCtx();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      if (type === 'success') {
        // Som de sucesso (duas notas ascendentes)
        oscillator.frequency.value = 523.25; // C5
        oscillator.start();
        setTimeout(() => {
          oscillator.frequency.value = 659.25; // E5
        }, 100);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
        oscillator.stop(audioContext.currentTime + 0.3);
      } else {
        // Som de erro (nota descendente)
        oscillator.frequency.value = 400;
        oscillator.type = 'triangle';
        oscillator.start();
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
        oscillator.stop(audioContext.currentTime + 0.2);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (blocked) return;
    
    if (pin.some((d) => d === "")) {
      setError("Preencha todos os dígitos");
      setShake(true);
      setTimeout(() => setShake(false), 500);
      playSound('error');
      return;
    }
    
    setError("");
    const pinStr = pin.join("");
    
    try {
      const res = await signIn("credentials", { pin: pinStr, redirect: false });
      
      if (res?.error) {
        // PIN inválido
        setError("PIN incorreto. Tente novamente.");
        setShake(true);
        setBlocked(true);
        setTimer(5);
        playSound('error');
        
        setTimeout(() => setShake(false), 500);
        
        let t = 5;
        const interval = setInterval(() => {
          t--;
          setTimer(t);
          if (t <= 0) {
            setBlocked(false);
            setError("");
            setPin(["", "", "", ""]);
            inputsRef.current[0]?.focus();
            clearInterval(interval);
          }
        }, 1000);
      } else {
        // Sucesso
        setSuccess(true);
        playSound('success');
        setTimeout(() => {
          router.replace("/dashboard");
        }, 800);
      }
    } catch {
      setError("Erro ao processar. Tente novamente.");
      playSound('error');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center app-gradient-bg relative overflow-hidden">
      {/* Animação de fundo */}
      <div className="absolute inset-0 overflow-hidden">
        <motion.div
          className="absolute -top-1/2 -left-1/2 w-full h-full brand-gradient/20 rounded-full blur-3xl"
          animate={{
            scale: [1, 1.2, 1],
            rotate: [0, 90, 0],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: "linear"
          }}
        />
        <motion.div
          className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-linear-to-tl from-yellow-500/5 to-transparent rounded-full blur-3xl"
          animate={{
            scale: [1.2, 1, 1.2],
            rotate: [90, 0, 90],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: "linear"
          }}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="relative z-10"
      >
        <motion.form
          onSubmit={handleSubmit}
          ref={formRef}
          className="flex flex-col items-center justify-center backdrop-blur-xl rounded-3xl shadow-2xl p-12 w-full max-w-md border border-zinc-800/50 theme-surface theme-border"
          animate={shake ? {
            x: [-10, 10, -10, 10, 0],
            transition: { duration: 0.4 }
          } : {}}
        >
          {/* Logo/Ícone */}
          <motion.div
            className="mb-6"
            initial={{ scale: 0 }}
            animate={{ scale: 1, rotate: success ? 360 : 0 }}
            transition={{ 
              type: "spring", 
              stiffness: 200, 
              damping: 15,
              rotate: { duration: 0.6 }
            }}
          >
            <div className="relative">
              <div className="w-20 h-20 rounded-2xl brand-btn flex items-center justify-center shadow-xl">
                <AnimatePresence mode="wait">
                  {success ? (
                    <motion.div
                      key="success"
                      initial={{ scale: 0, rotate: -180 }}
                      animate={{ scale: 1, rotate: 0 }}
                      exit={{ scale: 0, rotate: 180 }}
                    >
                      <FaCheckCircle className="text-4xl text-white" />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="lock"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0 }}
                    >
                      <FaLock className="text-4xl text-white" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <motion.div
                className="absolute -inset-2 brand-btn rounded-2xl blur-xl opacity-50"
                animate={{
                  opacity: [0.3, 0.6, 0.3],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              />
            </div>
          </motion.div>

          {/* Título */}
          <motion.h1 
            className="text-4xl font-bold brand-gradient bg-clip-text text-transparent mb-3 tracking-tight"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            PDV Burguer
          </motion.h1>

          <motion.div
            className="flex items-center gap-2 mb-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <FaShieldAlt className="text-zinc-500 text-sm" />
            <p className="text-zinc-400 text-sm">
              Acesso seguro ao sistema
            </p>
          </motion.div>

          {/* Inputs PIN */}
          <div className="flex gap-3 mb-6">
            {pin.map((d, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 + idx * 0.1 }}
              >
                <input
                  ref={(el) => { inputsRef.current[idx] = el; }}
                  type="password"
                  maxLength={1}
                  inputMode="numeric"
                  disabled={blocked || success}
                  value={d}
                  onChange={(e) => handleChange(idx, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(idx, e)}
                  onPaste={idx === 0 ? handlePaste : undefined}
                  className={`w-16 h-16 text-3xl text-center rounded-xl border-2 bg-zinc-800/50 text-white outline-none transition-all font-mono backdrop-blur
                    ${blocked || success ? 'opacity-50 cursor-not-allowed' : 'hover:bg-zinc-800/70'}
                    ${d ? 'border-orange-500 bg-zinc-800/70' : 'border-zinc-700'}
                    ${error && !blocked ? 'border-red-500/50' : ''}
                    focus:border-orange-500 focus:bg-zinc-800 focus:scale-105 focus:shadow-lg focus:shadow-orange-500/20
                  `}
                />
              </motion.div>
            ))}
          </div>

          {/* Mensagens de erro/sucesso */}
          <AnimatePresence mode="wait">
            {error && (
              <motion.div
                key="error"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex items-center gap-2 text-red-400 text-sm mb-4 bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-2"
              >
                <FaTimesCircle className="text-base" />
                <span>
                  {error}
                  {blocked && timer > 0 && (
                    <span className="font-mono font-bold ml-1">({timer}s)</span>
                  )}
                </span>
              </motion.div>
            )}
            
            {success && (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex items-center gap-2 text-green-400 text-sm mb-4 bg-green-500/10 border border-green-500/30 rounded-lg px-4 py-2"
              >
                <FaCheckCircle className="text-base" />
                <span>Acesso autorizado! Redirecionando...</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Botão */}
          <motion.button
            type="submit"
            disabled={blocked || success}
            className={`w-full py-4 rounded-xl font-bold text-lg transition-all relative overflow-hidden
              ${blocked || success 
                ? 'bg-zinc-700 cursor-not-allowed opacity-50' 
                : 'brand-btn hover:brightness-110 shadow-lg hover:shadow-xl active:scale-95'
              }
            `}
            whileHover={!blocked && !success ? { scale: 1.02 } : {}}
            whileTap={!blocked && !success ? { scale: 0.98 } : {}}
          >
            <span className="relative z-10 text-white">
              {success ? 'Entrando...' : blocked ? `Bloqueado (${timer}s)` : 'Entrar no Sistema'}
            </span>
            {!blocked && !success && (
              <motion.div
                className="absolute inset-0 bg-linear-to-r from-transparent via-white/20 to-transparent"
                initial={{ x: '-100%' }}
                animate={{ x: '200%' }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "linear"
                }}
              />
            )}
          </motion.button>

          {/* Dica */}
          <motion.p
            className="text-zinc-600 text-xs mt-6 text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
          >
            Digite seu PIN de 4 dígitos para acessar o sistema
          </motion.p>
        </motion.form>
      </motion.div>
    </div>
  );
}
