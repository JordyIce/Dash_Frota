import { ReactNode } from 'react';
import { Loader2, AlertCircle, Inbox } from 'lucide-react';

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 mb-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Loading({ label = 'Carregando dados...' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-slate-500">
      <Loader2 className="w-7 h-7 animate-spin text-beq-blue" />
      <div className="mt-3 text-sm">{label}</div>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mb-3">
        <AlertCircle className="w-6 h-6 text-red-600" />
      </div>
      <h3 className="text-sm font-semibold text-slate-900">Falha ao carregar</h3>
      <p className="text-xs text-slate-500 mt-1 max-w-md">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-4 px-4 py-2 bg-beq-blue text-white text-sm rounded-lg hover:bg-beq-blue/90 transition"
        >
          Tentar novamente
        </button>
      )}
    </div>
  );
}

export function EmptyState({
  title = 'Sem dados',
  message = 'Não há transações para os filtros selecionados.',
}: {
  title?: string;
  message?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
        <Inbox className="w-6 h-6 text-slate-400" />
      </div>
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      <p className="text-xs text-slate-500 mt-1 max-w-sm">{message}</p>
    </div>
  );
}

export function Card({
  title,
  subtitle,
  children,
  actions,
  className = '',
}: {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`bg-white rounded-xl border border-slate-200 shadow-card overflow-hidden ${className}`}>
      {(title || actions) && (
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
          <div>
            {title && <h3 className="text-sm font-semibold text-slate-800">{title}</h3>}
            {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  );
}

export function Badge({
  children,
  tone = 'default',
}: {
  children: ReactNode;
  tone?: 'default' | 'good' | 'warn' | 'bad';
}) {
  const styles: Record<typeof tone, string> = {
    default: 'bg-slate-100 text-slate-700',
    good: 'bg-emerald-50 text-emerald-700',
    warn: 'bg-amber-50 text-amber-700',
    bad: 'bg-red-50 text-red-700',
  };
  return (
    <span className={`inline-block text-[11px] font-medium px-2 py-0.5 rounded ${styles[tone]}`}>
      {children}
    </span>
  );
}
