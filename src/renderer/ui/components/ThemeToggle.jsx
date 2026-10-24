import React, { useState } from 'react';
import { Sun, Moon } from 'lucide-react';
import { currentTheme, setTheme } from '../utils/theme';

export function ThemeToggle({ className = '' }) {
  const [theme, setLocal] = useState(currentTheme());
  const next = theme === 'dark' ? 'light' : 'dark';

  return (
    <button
      type="button"
      onClick={() => { setTheme(next); setLocal(next); }}
      aria-label={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      title={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
      className={`p-2 rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground transition-colors ${className}`}
    >
      {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
    </button>
  );
}
