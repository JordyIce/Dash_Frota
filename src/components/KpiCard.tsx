import type { LucideIcon } from 'lucide-react';

interface Props {
  label: string;
  value: string;
  hint?: string;
  icon?: LucideIcon;
  tone?: 'default' | 'good' | 'warn' | 'bad';
  delta?: { value: string; positive: boolean };
}

const toneStyle: Record<NonNullable<Props['tone']>, string> = {
  default: 'bg-beq-blue/10 text-beq-blue',
  good: 'bg-emerald-50 text-emerald-700',
  warn: 'bg-amber-50 text-amber-700',
  bad: 'bg-red-50 text-red-700',
};

export function KpiCard({ label, value, hint, icon: Icon, tone = 'default', delta }: Props) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-card hover:shadow-cardHover transition">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            {label}
          </div>
          <div className="text-xl font-bold text-slate-900 mt-1 tabular-nums truncate">
            {value}
          </div>
          {hint && <div className="text-xs text-slate-500 mt-0.5 truncate">{hint}</div>}
        </div>
        {Icon && (
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${toneStyle[tone]}`}>
            <Icon className="w-4 h-4" />
          </div>
        )}
      </div>
      {delta && (
        <div
          className={`mt-2 inline-flex items-center text-xs font-medium ${
            delta.positive ? 'text-emerald-600' : 'text-red-600'
          }`}
        >
          {delta.positive ? '▲' : '▼'} {delta.value}
        </div>
      )}
    </div>
  );
}
