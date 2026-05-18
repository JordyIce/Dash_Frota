import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Sidebar } from '@/components/Sidebar';
import { GlobalFilters } from '@/components/GlobalFilters';
import { DataProvider, useData } from '@/contexts/DataContext';
import { FiltersProvider } from '@/contexts/FiltersContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { Loading, ErrorState } from '@/components/UI';

import { Orcamento } from '@/pages/Orcamento';
import { Consumo } from '@/pages/Consumo';
import { RankingKmL } from '@/pages/RankingKmL';
import { ConsumoTemporal } from '@/pages/ConsumoTemporal';
import { Condutores } from '@/pages/Condutores';
import { MotorOcioso } from '@/pages/MotorOcioso';
import { EvolucaoSemanal } from '@/pages/EvolucaoSemanal';
import { PrecoLt } from '@/pages/PrecoLt';
import { PerformanceStratws } from '@/pages/PerformanceStratws';

function Shell() {
  const { loading, error, reload, loadedAt } = useData();

  return (
    <div className="min-h-screen flex bg-slate-50">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <GlobalFilters />
        <main className="flex-1 p-6 overflow-x-hidden">
          {loading && <Loading />}
          {error && !loading && <ErrorState message={error} onRetry={reload} />}
          {!loading && !error && (
            <Routes>
              <Route path="/" element={<Navigate to="/orcamento" replace />} />
              <Route path="/orcamento" element={<Orcamento />} />
              <Route path="/consumo" element={<Consumo />} />
              <Route path="/ranking" element={<RankingKmL />} />
              <Route path="/periodo" element={<ConsumoTemporal />} />
              <Route path="/condutores" element={<Condutores />} />
              <Route path="/ocioso" element={<MotorOcioso />} />
              <Route path="/evolucao" element={<EvolucaoSemanal />} />
              <Route path="/preco" element={<PrecoLt />} />
              <Route path="/performance" element={<PerformanceStratws />} />
              <Route path="*" element={<Navigate to="/orcamento" replace />} />
            </Routes>
          )}
        </main>
        {loadedAt && !loading && !error && (
          <div className="px-6 py-2 text-[11px] text-slate-400 border-t border-slate-200 bg-white">
            Dados atualizados em {loadedAt.toLocaleString('pt-BR')}
            <button onClick={reload} className="ml-3 text-beq-blue hover:underline">
              Atualizar agora
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <DataProvider>
          <FiltersProvider>
            <Shell />
          </FiltersProvider>
        </DataProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
