import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { fetchAll } from '@/lib/data';
import type { OciosoDia, Transacao } from '@/lib/types';

interface DataCtx {
  data: Transacao[];                       // Veloe com gerente já cruzado
  ocioso: OciosoDia[];                     // Base ZUQ
  placasGerente: Map<string, string>;      // placa → gerente
  loading: boolean;
  error: string | null;
  reload: () => void;
  loadedAt: Date | null;
}

const Ctx = createContext<DataCtx | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<Transacao[]>([]);
  const [ocioso, setOcioso] = useState<OciosoDia[]>([]);
  const [placasGerente, setPlacasGerente] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadedAt, setLoadedAt] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { veloe, ocioso, placasGerente } = await fetchAll();
      setData(veloe);
      setOcioso(ocioso);
      setPlacasGerente(placasGerente);
      setLoadedAt(new Date());
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Ctx.Provider value={{ data, ocioso, placasGerente, loading, error, reload: load, loadedAt }}>
      {children}
    </Ctx.Provider>
  );
}

export function useData(): DataCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('useData precisa estar dentro de <DataProvider>');
  return v;
}
