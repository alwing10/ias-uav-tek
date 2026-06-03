import { Outlet } from 'react-router-dom';
import { useEffect } from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { useLiveData } from '@/store/liveData';

export function Layout() {
  const startAutoRefresh = useLiveData((s) => s.startAutoRefresh);
  const stopAutoRefresh = useLiveData((s) => s.stopAutoRefresh);

  // Запускаем автообновление live-данных при входе в защищённую часть
  useEffect(() => {
    startAutoRefresh();
    return () => stopAutoRefresh();
  }, [startAutoRefresh, stopAutoRefresh]);

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
