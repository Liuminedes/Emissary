import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Loader2, Search, Send, Bot, UserRound, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';

const telefonoDe = (userId) => userId.replace(/[@:].*$/, '').replace(/\D/g, '');

function horaRelativa(ts) {
  const min = Math.floor((Date.now() - ts) / 60000);
  if (min < 1) return 'ahora';
  if (min < 60) return `${min} min`;
  if (min < 1440) return `${Math.floor(min / 60)} h`;
  return new Date(ts).toLocaleDateString();
}

// Quién tiene el chat: lo que el asesor necesita ver de un vistazo
function estadoDe(c) {
  if (c.advisor_took) return { label: 'Asesor', cls: 'bg-amber-500/10 text-amber-600' };
  if (c.handoff_mode) return { label: 'Pide asesor', cls: 'bg-rose-500/10 text-rose-600' };
  return { label: 'Bot', cls: 'bg-emerald-500/10 text-emerald-600' };
}

const ORIGEN_ESTILO = {
  cliente: 'self-start bg-muted text-foreground rounded-2xl rounded-bl-md',
  bot: 'self-end bg-primary/10 text-foreground rounded-2xl rounded-br-md',
  asesor: 'self-end bg-primary text-primary-foreground rounded-2xl rounded-br-md',
};

export function Inbox() {
  const [conversations, setConversations] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);
  const selectedRef = useRef(null);
  selectedRef.current = selectedId;

  const loadConversations = useCallback(async () => {
    try {
      setConversations((await window.emissary.listConversations()) || []);
    } catch {
      toast.error('Error al cargar conversaciones');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMessages = useCallback(async (userId) => {
    setMessages((await window.emissary.getConversation(userId)) || []);
  }, []);

  useEffect(() => {
    loadConversations();
    // Tiempo real: el main avisa cuando entra o sale un mensaje
    return window.emissary.onInboxUpdated(({ userId }) => {
      loadConversations();
      if (userId === selectedRef.current) loadMessages(userId);
    });
  }, [loadConversations, loadMessages]);

  useEffect(() => {
    if (selectedId) loadMessages(selectedId);
  }, [selectedId, loadMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [messages]);

  const selected = conversations.find((c) => c.user_id === selectedId);
  const asesorTieneElChat = selected && (selected.advisor_took || selected.handoff_mode);
  const filtered = conversations.filter((c) => {
    const q = search.trim().toLowerCase();
    return !q || c.nombre.toLowerCase().includes(q) || c.user_id.includes(q);
  });

  const toggleControl = async () => {
    if (asesorTieneElChat) {
      await window.emissary.releaseControl(selectedId);
      toast.success('El bot retomó la conversación');
    } else {
      await window.emissary.takeControl(selectedId);
      toast.success('Tienes el control: el bot no responderá');
    }
  };

  const send = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    const res = await window.emissary.sendInbox(selectedId, text);
    setSending(false);
    if (!res?.ok) return toast.error(res?.error || 'No se pudo enviar');
    setDraft('');
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  if (loading) {
    return <div className="flex h-full items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="flex gap-6" style={{ height: 'calc(100vh - 5rem)' }}>
      {/* Lista de conversaciones */}
      <aside className="w-80 shrink-0 flex flex-col bg-card border border-border/50 rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-border/50">
          <h1 className="text-xl font-semibold tracking-tight mb-3">Conversaciones</h1>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              aria-label="Buscar conversación"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar nombre o número"
              className="w-full bg-background border border-border rounded-xl pl-9 pr-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>
        <ul className="flex-1 overflow-y-auto custom-scrollbar">
          {filtered.length === 0 && (
            <li className="p-6 text-sm text-muted-foreground text-center">
              {conversations.length === 0 ? 'Aún no hay conversaciones. Aparecerán cuando un cliente escriba.' : 'Sin resultados.'}
            </li>
          )}
          {filtered.map((c) => {
            const estado = estadoDe(c);
            const activa = c.user_id === selectedId;
            return (
              <li key={c.user_id}>
                <button
                  onClick={() => setSelectedId(c.user_id)}
                  aria-current={activa ? 'true' : undefined}
                  className={`w-full text-left px-4 py-3 border-b border-border/30 transition-colors ${activa ? 'bg-primary/10' : 'hover:bg-muted'}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-sm truncate">{c.nombre}</span>
                    <span className="text-xs text-muted-foreground shrink-0">{horaRelativa(c.ultimo_at)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    {c.ultimo_origen !== 'cliente' && 'Tú: '}{c.ultimo_texto}
                  </p>
                  <span className={`inline-block mt-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full ${estado.cls}`}>{estado.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </aside>

      {/* Conversación */}
      <section className="flex-1 min-w-0 flex flex-col bg-card border border-border/50 rounded-2xl overflow-hidden">
        {!selected ? (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-3">
            <MessageSquare className="w-10 h-10" />
            <p className="text-sm">Selecciona una conversación</p>
          </div>
        ) : (
          <>
            <header className="flex items-center justify-between gap-4 p-4 border-b border-border/50">
              <div className="min-w-0">
                <h2 className="font-semibold truncate">{selected.nombre}</h2>
                <p className="text-xs text-muted-foreground">+{telefonoDe(selected.user_id)}</p>
              </div>
              <button
                onClick={toggleControl}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                  asesorTieneElChat ? 'bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20' : 'bg-primary text-primary-foreground hover:opacity-90'
                }`}
              >
                {asesorTieneElChat ? <><Bot className="w-4 h-4" /> Devolver al bot</> : <><UserRound className="w-4 h-4" /> Tomar control</>}
              </button>
            </header>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 flex flex-col gap-2">
              {messages.map((m) => (
                <div key={m.id} className={`max-w-[75%] px-4 py-2.5 text-sm whitespace-pre-wrap break-words ${ORIGEN_ESTILO[m.origen]}`}>
                  {m.origen === 'bot' && <span className="block text-[10px] font-semibold uppercase tracking-wider text-primary mb-0.5">Bot</span>}
                  {m.texto}
                  <span className="block text-[10px] opacity-60 mt-1 text-right">{new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>

            <footer className="p-4 border-t border-border/50">
              {!asesorTieneElChat && (
                <p className="text-xs text-muted-foreground mb-2">Si respondes desde aquí, tomas el control y el bot deja de contestar.</p>
              )}
              <div className="flex items-end gap-3">
                <textarea
                  aria-label="Escribir mensaje"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={onKeyDown}
                  rows={2}
                  maxLength={4096}
                  placeholder="Escribe un mensaje… (Enter envía, Shift+Enter salto de línea)"
                  className="flex-1 resize-none bg-background border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
                <button
                  onClick={send}
                  disabled={sending || !draft.trim()}
                  aria-label="Enviar mensaje"
                  className="p-3 rounded-xl bg-primary text-primary-foreground disabled:opacity-40 hover:opacity-90 transition-opacity"
                >
                  {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                </button>
              </div>
            </footer>
          </>
        )}
      </section>
    </div>
  );
}
