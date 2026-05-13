import { Sun, Moon } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const isDark = theme === 'dark';
  return (
    <button
      onClick={toggle}
      title={isDark ? 'Tema claro' : 'Tema escuro'}
      className="flex items-center justify-center w-9 h-9 rounded-lg bg-white/5 hover:bg-white/10 text-slate-200 transition"
      aria-label="Alternar tema"
    >
      {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </button>
  );
}
