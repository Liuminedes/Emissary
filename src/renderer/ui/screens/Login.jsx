import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Loader2, LogIn, ShieldCheck } from 'lucide-react';
import logoImg from '../../assets/logo.png';
import { ThemeToggle } from '../components/ThemeToggle';

// needsSetup: primer uso, no existe contraseña de admin y se crea aquí (no hay contraseña por defecto)
export function Login({ needsSetup, onAuthenticated }) {
  const [username, setUsername] = useState(needsSetup ? 'admin' : '');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (needsSetup) {
      if (password.length < 8) return setError('La contraseña debe tener al menos 8 caracteres');
      if (password !== confirm) return setError('Las contraseñas no coinciden');
    } else if (!username.trim() || !password) {
      return setError('Escribe tu usuario y contraseña');
    }
    setBusy(true);
    try {
      const res = needsSetup
        ? await window.emissary.authSetup(password)
        : await window.emissary.authLogin(username, password);
      if (!res.ok) { setError(res.error); setPassword(''); return; }
      onAuthenticated(res.data);
    } catch {
      setError('No se pudo iniciar sesión. Intenta de nuevo.');
    } finally {
      setBusy(false);
    }
  };

  const input = 'w-full bg-background border border-border rounded-xl px-4 py-3 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all';

  return (
    <div className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden bg-background">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-primary/5 pointer-events-none" aria-hidden="true" />
      <ThemeToggle className="absolute top-4 right-4" />

      <motion.main
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="relative w-full max-w-md bg-card border border-border/50 rounded-3xl shadow-glass p-8 sm:p-10"
      >
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-16 h-16 rounded-2xl overflow-hidden bg-black ring-1 ring-border/50 shadow-float mb-5">
            <img src={logoImg} alt="Emissary" className="w-full h-full object-cover" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {needsSetup ? 'Bienvenido a Emissary' : 'Iniciar sesión'}
          </h1>
          <p className="text-sm text-muted-foreground mt-1.5">
            {needsSetup
              ? 'Crea la contraseña de la cuenta administradora para empezar.'
              : 'Ingresa con tu usuario para atender tu WhatsApp.'}
          </p>
        </div>

        <form onSubmit={submit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <label htmlFor="usuario" className="text-sm font-medium">Usuario</label>
            <input
              id="usuario"
              type="text"
              autoComplete="username"
              autoFocus={!needsSetup}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              readOnly={needsSetup}
              className={`${input} ${needsSetup ? 'bg-muted/50 text-muted-foreground cursor-not-allowed' : ''}`}
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="clave" className="text-sm font-medium">{needsSetup ? 'Nueva contraseña' : 'Contraseña'}</label>
            <div className="relative">
              <input
                id="clave"
                type={showPw ? 'text' : 'password'}
                autoComplete={needsSetup ? 'new-password' : 'current-password'}
                autoFocus={needsSetup}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`${input} pr-12`}
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                aria-label={showPw ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
              >
                {showPw ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            {needsSetup && <p className="text-xs text-muted-foreground">Mínimo 8 caracteres. Guárdala: no hay forma de recuperarla sin acceso al equipo.</p>}
          </div>

          {needsSetup && (
            <div className="space-y-1.5">
              <label htmlFor="confirmar" className="text-sm font-medium">Confirmar contraseña</label>
              <input
                id="confirmar"
                type={showPw ? 'text' : 'password'}
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className={input}
              />
            </div>
          )}

          <div aria-live="polite" className="min-h-[1.25rem]">
            {error && <p role="alert" className="text-sm text-destructive font-medium">{error}</p>}
          </div>

          <button
            type="submit"
            disabled={busy}
            className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl bg-primary text-primary-foreground font-medium hover:bg-primary-hover transition-colors shadow-float active:scale-[0.99] disabled:opacity-70"
          >
            {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : needsSetup ? <ShieldCheck className="w-5 h-5" /> : <LogIn className="w-5 h-5" />}
            {needsSetup ? 'Crear cuenta y entrar' : 'Entrar'}
          </button>
        </form>

        <p className="text-center text-[11px] uppercase tracking-widest font-semibold text-muted-foreground mt-8">Powered by Vyntra Orbit</p>
      </motion.main>
    </div>
  );
}
