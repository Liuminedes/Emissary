import React, { useEffect, useState, useCallback } from 'react';
import { KeyRound, Users, Trash2, Loader2, UserPlus, Smartphone, Unlink } from 'lucide-react';
import { toast } from 'sonner';
import { useConfirm } from './ConfirmDialog';

const input = 'w-full bg-background border border-border rounded-xl px-4 py-2.5 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all text-sm';
const card = 'bg-card border border-border/50 rounded-2xl shadow-glass overflow-hidden';
const head = 'p-6 border-b border-border/30 bg-muted/10 flex items-center gap-3';

// Muestra el error del servidor o confirma; devuelve true si salió bien
const report = (res, okMsg) => {
  if (!res.ok) { toast.error(res.error); return false; }
  toast.success(okMsg);
  return true;
};

export function AccountSecurity() {
  const [f, setF] = useState({ actual: '', nueva: '', repetir: '' });
  const [busy, setBusy] = useState(false);
  const set = (e) => setF((s) => ({ ...s, [e.target.name]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (f.nueva !== f.repetir) return toast.error('Las contraseñas nuevas no coinciden');
    setBusy(true);
    try {
      if (report(await window.emissary.changePassword(f.actual, f.nueva), 'Contraseña actualizada')) setF({ actual: '', nueva: '', repetir: '' });
    } finally { setBusy(false); }
  };

  return (
    <div className={card}>
      <div className={head}><KeyRound className="w-5 h-5 text-primary" /><h2 className="text-lg font-medium">Mi contraseña</h2></div>
      <form onSubmit={submit} className="p-6 space-y-3">
        <input type="password" name="actual" value={f.actual} onChange={set} autoComplete="current-password" aria-label="Contraseña actual" placeholder="Contraseña actual" className={input} />
        <input type="password" name="nueva" value={f.nueva} onChange={set} autoComplete="new-password" aria-label="Contraseña nueva" placeholder="Contraseña nueva (mín. 8)" className={input} />
        <input type="password" name="repetir" value={f.repetir} onChange={set} autoComplete="new-password" aria-label="Repetir contraseña nueva" placeholder="Repite la nueva" className={input} />
        <button type="submit" disabled={busy || !f.actual || !f.nueva} className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary-hover transition-colors disabled:opacity-60">
          {busy && <Loader2 className="w-4 h-4 animate-spin" />}Cambiar contraseña
        </button>
      </form>
    </div>
  );
}

// Solo la cuenta administradora ve este panel: crea y administra las cuentas de los demás
export function UsersAdmin({ currentUserId }) {
  const confirmar = useConfirm();
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({ username: '', password: '', role: 'asesor' });
  const [resetting, setResetting] = useState(null); // { id, password }
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await window.emissary.listUsers();
    if (res.ok) setUsers(res.data);
  }, []);
  useEffect(() => { load(); }, [load]);

  const create = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (report(await window.emissary.createUser(form), `Usuario ${form.username.trim().toLowerCase()} creado`)) {
        setForm({ username: '', password: '', role: 'asesor' });
        load();
      }
    } finally { setBusy(false); }
  };

  const reset = async (e) => {
    e.preventDefault();
    if (report(await window.emissary.resetUserPassword(resetting.id, resetting.password), 'Contraseña restablecida')) setResetting(null);
  };

  const remove = async (u) => {
    const ok = await confirmar({ title: 'Eliminar usuario', message: `${u.username} no podrá volver a entrar a Emissary.`, confirmLabel: 'Eliminar', danger: true });
    if (!ok) return;
    if (report(await window.emissary.deleteUser(u.id), 'Usuario eliminado')) load();
  };

  return (
    <div className={card}>
      <div className={head}><Users className="w-5 h-5 text-primary" /><h2 className="text-lg font-medium">Usuarios</h2></div>
      <div className="p-6 space-y-5">
        <ul className="divide-y divide-border/40 -my-2">
          {users.map((u) => (
            <li key={u.id} className="py-3">
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{u.username}</p>
                  <p className="text-xs text-muted-foreground">{u.role === 'admin' ? 'Administrador' : 'Asesor'}</p>
                </div>
                <button type="button" onClick={() => setResetting({ id: u.id, password: '' })} className="text-xs font-medium text-primary hover:underline">Cambiar clave</button>
                {u.id !== currentUserId && (
                  <button type="button" onClick={() => remove(u)} aria-label={`Eliminar a ${u.username}`} className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
              {resetting?.id === u.id && (
                <form onSubmit={reset} className="flex gap-2 mt-3">
                  <input type="password" autoFocus value={resetting.password} onChange={(e) => setResetting({ id: u.id, password: e.target.value })} aria-label={`Nueva contraseña para ${u.username}`} placeholder="Nueva contraseña (mín. 8)" autoComplete="new-password" className={input} />
                  <button type="submit" className="px-4 rounded-xl bg-primary text-primary-foreground text-sm font-medium">Guardar</button>
                  <button type="button" onClick={() => setResetting(null)} className="px-3 rounded-xl border border-border text-sm">Cancelar</button>
                </form>
              )}
            </li>
          ))}
        </ul>

        <form onSubmit={create} className="space-y-3 pt-4 border-t border-border/40">
          <p className="text-sm font-medium flex items-center gap-2"><UserPlus className="w-4 h-4 text-muted-foreground" />Nuevo usuario</p>
          <input name="username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} aria-label="Usuario nuevo" placeholder="usuario" autoComplete="off" className={input} />
          <input type="password" name="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} aria-label="Contraseña del usuario nuevo" placeholder="Contraseña (mín. 8)" autoComplete="new-password" className={input} />
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} aria-label="Rol" className={input}>
            <option value="asesor">Asesor (usa Emissary)</option>
            <option value="admin">Administrador (además gestiona usuarios)</option>
          </select>
          <button type="submit" disabled={busy || !form.username || !form.password} className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary-hover transition-colors disabled:opacity-60">
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}Crear usuario
          </button>
        </form>
      </div>
    </div>
  );
}

// Antes vivía en "Cerrar sesión", donde se confundía con salir de la app
export function WhatsAppUnlink() {
  const confirmar = useConfirm();
  const unlink = async () => {
    const ok = await confirmar({
      title: 'Desvincular WhatsApp',
      message: 'El bot dejará de responder y tendrás que escanear un QR nuevo para reconectar. Tus conversaciones y leads se conservan.',
      confirmLabel: 'Desvincular', danger: true,
    });
    if (!ok) return;
    await window.emissary.logoutWa();
    toast.success('WhatsApp desvinculado. Escanea el nuevo QR desde el Dashboard.');
  };

  return (
    <div className={card}>
      <div className={head}><Smartphone className="w-5 h-5 text-primary" /><h2 className="text-lg font-medium">WhatsApp</h2></div>
      <div className="p-6">
        <p className="text-xs text-muted-foreground mb-4">Desvincula el número actual para conectar otro. Tus conversaciones y leads se conservan.</p>
        <button type="button" onClick={unlink} className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl border border-destructive/40 text-destructive text-sm font-medium hover:bg-destructive/10 transition-colors">
          <Unlink className="w-4 h-4" />Desvincular WhatsApp
        </button>
      </div>
    </div>
  );
}
