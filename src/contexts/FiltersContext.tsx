import { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import { emptyFilters, type FilterState } from '@/lib/types';

interface FiltersCtx {
  filters: FilterState;
  setFilters: (f: FilterState) => void;
  updateFilter: <K extends keyof FilterState>(key: K, value: FilterState[K]) => void;
  resetFilters: () => void;
}

const Ctx = createContext<FiltersCtx | null>(null);

export function FiltersProvider({ children }: { children: ReactNode }) {
  const [filters, setFilters] = useState<FilterState>(emptyFilters);

  const updateFilter = useCallback(
    <K extends keyof FilterState>(key: K, value: FilterState[K]) => {
      setFilters((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const resetFilters = useCallback(() => setFilters(emptyFilters), []);

  return (
    <Ctx.Provider value={{ filters, setFilters, updateFilter, resetFilters }}>
      {children}
    </Ctx.Provider>
  );
}

export function useFilters(): FiltersCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('useFilters precisa estar dentro de <FiltersProvider>');
  return v;
}
