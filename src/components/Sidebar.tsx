import { NavLink } from 'react-router-dom';
import {
  Wallet,
  Fuel,
  Trophy,
  CalendarRange,
  Users,
  Gauge,
  TrendingUp,
  Tag,
  Truck,
  LayoutGrid,
} from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';

const links = [
  { to: '/orcamento', label: 'Orçamento', icon: Wallet, hint: 'Gasto de combustível' },
  { to: '/resumo-gerencial', label: 'Resumo Gerencial', icon: Target, hint: 'Meta × Realizado por gerente' },
  { to: '/consumo', label: 'Consumo', icon: Fuel, hint: 'Por gerente' },
  { to: '/performance', label: 'Performance Stratws', icon: LayoutGrid, hint: 'Geral × Gerência · Tipo × Mês' },
  { to: '/ranking', label: 'Ranking KM/L', icon: Trophy, hint: 'Melhores e piores' },
  { to: '/periodo', label: 'Período', icon: CalendarRange, hint: 'Dia/semana/mês/ano' },
  { to: '/condutores', label: 'Condutores', icon: Users, hint: 'Abaixo da meta' },
  { to: '/ocioso', label: 'Motor Ocioso', icon: Gauge, hint: 'Por gerência/placa' },
  { to: '/evolucao', label: 'Evolução Semanal', icon: TrendingUp, hint: 'Tendência semanal' },
  { to: '/preco', label: 'Preço por LT', icon: Tag, hint: 'Por operação' },
];

export function Sidebar() {
  return (
    <aside className="hidden md:flex md:flex-col w-64 shrink-0 bg-beq-navyDark border-r border-white/5 text-slate-200">
      <div className="px-5 py-5 border-b border-white/5 flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-beq-blue flex items-center justify-center shadow">
          <Truck className="w-5 h-5 text-white" />
        </div>
        <div>
          <div className="text-sm font-bold tracking-tight leading-tight">Dash Frota</div>
          <div className="text-[11px] text-slate-400 leading-tight">B&Q Energia</div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-3 px-2">
        {links.map(({ to, label, icon: Icon, hint }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              [
                'group flex items-start gap-3 px-3 py-2.5 rounded-lg mb-1 transition-colors',
                isActive
                  ? 'bg-beq-blue/20 text-white border-l-2 border-beq-accent'
                  : 'text-slate-300 hover:bg-white/5 hover:text-white border-l-2 border-transparent',
              ].join(' ')
            }
          >
            <Icon className="w-4 h-4 mt-0.5 shrink-0" />
            <div className="min-w-0">
              <div className="text-sm font-medium leading-tight">{label}</div>
              <div className="text-[11px] text-slate-400 leading-tight mt-0.5 truncate">{hint}</div>
            </div>
          </NavLink>
        ))}
      </nav>

      <div className="px-4 py-3 border-t border-white/5 flex items-center justify-between gap-2">
        <span className="text-[11px] text-slate-500">v0.1 · Planejamento B&Q</span>
        <ThemeToggle />
      </div>
    </aside>
  );
}
