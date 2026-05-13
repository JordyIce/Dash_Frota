import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, X } from 'lucide-react';

interface Props {
  label: string;
  options: string[];
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}

export function MultiSelect({ label, options, value, onChange, placeholder = 'Todos' }: Props) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const filtered = q
    ? options.filter((o) => o.toLowerCase().includes(q.toLowerCase()))
    : options;

  function toggle(o: string) {
    if (value.includes(o)) onChange(value.filter((v) => v !== o));
    else onChange([...value, o]);
  }

  function clear(e: React.MouseEvent) {
    e.stopPropagation();
    onChange([]);
  }

  const summary = value.length === 0
    ? placeholder
    : value.length === 1
    ? value[0]
    : `${value.length} selecionados`;

  return (
    <div className="relative" ref={ref}>
      <label className="block text-[11px] font-medium text-slate-500 mb-1 uppercase tracking-wide">
        {label}
      </label>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm hover:border-beq-blue/40 focus:outline-none focus:ring-2 focus:ring-beq-blue/30"
      >
        <span className={`truncate ${value.length === 0 ? 'text-slate-400' : 'text-slate-800'}`}>
          {summary}
        </span>
        <span className="flex items-center gap-1 shrink-0">
          {value.length > 0 && (
            <X
              className="w-3.5 h-3.5 text-slate-400 hover:text-slate-700"
              onClick={clear}
            />
          )}
          <ChevronDown className={`w-4 h-4 text-slate-400 transition ${open ? 'rotate-180' : ''}`} />
        </span>
      </button>

      {open && (
        <div className="absolute z-30 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-72 overflow-hidden flex flex-col">
          <div className="p-2 border-b border-slate-100">
            <input
              autoFocus
              type="text"
              placeholder="Buscar..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-beq-blue"
            />
          </div>
          <div className="overflow-y-auto flex-1">
            {filtered.length === 0 && (
              <div className="px-3 py-4 text-sm text-slate-400 text-center">Nenhum resultado</div>
            )}
            {filtered.map((o) => {
              const checked = value.includes(o);
              return (
                <button
                  key={o}
                  type="button"
                  onClick={() => toggle(o)}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-slate-50 text-left"
                >
                  <span
                    className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                      checked ? 'bg-beq-blue border-beq-blue' : 'border-slate-300'
                    }`}
                  >
                    {checked && <Check className="w-3 h-3 text-white" />}
                  </span>
                  <span className="truncate text-slate-700">{o}</span>
                </button>
              );
            })}
          </div>
          {value.length > 0 && (
            <div className="border-t border-slate-100 px-2 py-1.5 flex justify-end">
              <button
                onClick={() => onChange([])}
                className="text-xs text-slate-500 hover:text-slate-800"
              >
                Limpar seleção
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
