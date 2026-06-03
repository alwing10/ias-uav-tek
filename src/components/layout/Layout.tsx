import { Outlet } from 'react-router-dom';
import { useEffect } from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { useLiveData } from '@/store/liveData';
import { useBackend } from '@/store/backendData';

export function Layout() {
  const startAutoRefresh = useLiveData((s) => s.startAutoRefresh);
  const stopAutoRefresh = useLiveData((s) => s.stopAutoRefresh);
  const startBackend = useBackend((s) => s.startAutoSync);
  const stopBackend = useBackend((s) => s.stopAutoSync);

  // Запускаем автообновление live-данных и backend при входе в защищённую часть
  useEffect(() => {
    startAutoRefresh();
    startBackend();
    return () => {
      stopAutoRefresh();
      stopBackend();
    };
  }, [startAutoRefresh, stopAutoRefresh, startBackend, stopBackend]);

  return (
    <div className="min-h-screen bg-surface">
      <Header />
      <Sidebar />
      <main className="ml-[220px] pt-14">
        <Outlet />
      </main>
    </div>
  );
}
