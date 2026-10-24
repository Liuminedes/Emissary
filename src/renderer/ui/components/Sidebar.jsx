import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { LayoutDashboard, ShoppingBag, MessageSquare, Users, Settings, LogOut, BookOpen, Rocket, Megaphone, Inbox } from 'lucide-react';
import { VyntraCreditsModal } from './VyntraCreditsModal';
import { ThemeToggle } from './ThemeToggle';
import logoImg from '../../assets/logo.png';

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'inbox', label: 'Conversaciones', icon: Inbox },
  { id: 'catalogo', label: 'Catálogo', icon: ShoppingBag },
  { id: 'mensajes', label: 'Mensajes', icon: MessageSquare },
  { id: 'masivos', label: 'Envíos Masivos', icon: Megaphone },
  { id: 'leads', label: 'Leads', icon: Users },
  { id: 'ajustes', label: 'Ajustes', icon: Settings },
  { id: 'guia', label: 'Guía', icon: BookOpen },
];

export function Sidebar({ currentRoute, onNavigate, onLogout, user }) {
  const [isCreditsOpen, setIsCreditsOpen] = useState(false);

  return (
    <nav className="w-64 h-screen border-r border-border/50 bg-white/70 dark:bg-black/50 backdrop-blur-xl flex flex-col justify-between sticky top-0 shrink-0">
      <div className="p-6">
        {/* Brand */}
        <div className="flex items-center gap-3 mb-10 px-2">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shadow-float overflow-hidden bg-black ring-1 ring-border/50">
            <img src={logoImg} alt="Emissary Logo" className="w-full h-full object-cover" />
          </div>
          <span className="font-semibold text-lg tracking-tight">Emissary</span>
        </div>

        {/* Navigation */}
        <ul className="space-y-1.5">
          {navItems.map((item) => {
            const isActive = currentRoute === item.id;
            const Icon = item.icon;
            return (
              <li key={item.id}>
                <button
                  onClick={() => onNavigate(item.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 ${
                    isActive 
                      ? 'bg-primary/10 text-primary font-medium' 
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  <Icon className="w-5 h-5" strokeWidth={isActive ? 2.5 : 2} />
                  <span className="text-sm">{item.label}</span>
                  {isActive && (
                    <motion.div
                      layoutId="activeTabIndicator"
                      className="absolute left-0 w-1 h-6 bg-primary rounded-r-full"
                      initial={false}
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="p-6">
        {user && (
          <div className="flex items-center gap-3 px-2 mb-3">
            <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold uppercase shrink-0" aria-hidden="true">
              {user.username.charAt(0)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">{user.username}</p>
              <p className="text-xs text-muted-foreground">{user.role === 'admin' ? 'Administrador' : 'Asesor'}</p>
            </div>
            <ThemeToggle />
          </div>
        )}

        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all duration-200"
        >
          <LogOut className="w-5 h-5" strokeWidth={2} />
          <span className="text-sm font-medium">Cerrar sesión</span>
        </button>

        <button
          onClick={() => setIsCreditsOpen(true)}
          className="w-full flex items-center justify-center gap-1.5 mt-6 pt-4 border-t border-border/40 text-[10px] uppercase tracking-widest font-semibold text-muted-foreground hover:text-[#a855f7] transition-colors group"
        >
          Powered by Vyntra <Rocket className="w-3 h-3 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition-transform" />
        </button>
      </div>

      <VyntraCreditsModal isOpen={isCreditsOpen} onClose={() => setIsCreditsOpen(false)} />
    </nav>
  );
}
