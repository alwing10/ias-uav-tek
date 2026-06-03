import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { Sidebar } from './Sidebar';

export function Layout() {
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
