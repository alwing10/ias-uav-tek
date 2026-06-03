import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DEMO_ACCOUNTS, useAuth } from '@/store/auth';
import { Button } from '@/components/common/Button';
import { ShieldAlert, ShieldCheck } from 'lucide-react';

export function LoginPage() {
  const [email, setEmail] = useState('analyst@iac.ru');
  const [password, setPassword] = useState('analyst');
  const [err, setErr] = useState<string | null>(null);
  const login = useAuth((s) => s.login);
  const navigate = useNavigate();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const ok = login(email, password);
    if (!ok) setErr('Неверный e-mail или пароль');
    else navigate('/dashboard');
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-700 to-brand-500 p-4">
      <div className="grid w-full max-w-4xl grid-cols-1 overflow-hidden rounded-card bg-white shadow-2xl md:grid-cols-[1.2fr_1fr]">
        <div className="bg-brand-700 p-10 text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded bg-white/15 text-sm font-bold">ИАС</div>
            <div>
              <div className="text-xs uppercase tracking-widest text-white/70">Демо-прототип</div>
              <h1 className="text-lg font-semibold">Модуль мониторинга</h1>
            </div>
          </div>
          <h2 className="mt-10 text-2xl font-bold leading-snug">
            Инциденты с применением БПЛА в отношении объектов ТЭК&nbsp;РФ
          </h2>
          <p className="mt-3 text-sm text-white/80">
            Сбор сообщений из открытых источников, нормализация и классификация инцидентов,
            аналитика, верификация экспертами и формирование отчётов.
          </p>
          <ul className="mt-8 space-y-2 text-sm text-white/90">
            <li className="flex items-start gap-2">
              <ShieldCheck className="mt-0.5 h-4 w-4" /> RBAC: Аналитик / Эксперт / Администратор
            </li>
            <li className="flex items-start gap-2">
              <ShieldCheck className="mt-0.5 h-4 w-4" /> Соответствие 10 эвристикам Нильсена
            </li>
            <li className="flex items-start gap-2">
              <ShieldAlert className="mt-0.5 h-4 w-4" /> Демо-данные генерируются на клиенте
            </li>
          </ul>
        </div>

        <form onSubmit={submit} className="p-8">
          <h3 className="text-base font-semibold text-ink">Вход в систему</h3>
          <label className="mt-5 block text-xs font-semibold text-ink-muted">
            E-mail
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 h-10 w-full rounded border border-surface-border px-3 text-sm focus:border-brand-600 focus:outline-none"
              required
            />
          </label>
          <label className="mt-3 block text-xs font-semibold text-ink-muted">
            Пароль
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 h-10 w-full rounded border border-surface-border px-3 text-sm focus:border-brand-600 focus:outline-none"
              required
            />
          </label>
          {err && (
            <div className="mt-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{err}</div>
          )}
          <Button type="submit" className="mt-5 w-full">
            Войти
          </Button>
          <button type="button" className="mt-3 block text-xs text-brand-600 hover:underline">
            Забыли пароль?
          </button>

          <div className="mt-6 rounded border border-surface-border bg-surface p-3 text-[11px]">
            <div className="mb-1 font-semibold text-ink-muted">Демо-аккаунты (кликните):</div>
            <div className="space-y-1">
              {DEMO_ACCOUNTS.map((a) => (
                <button
                  key={a.email}
                  type="button"
                  onClick={() => {
                    setEmail(a.email);
                    setPassword(a.password);
                  }}
                  className="block w-full rounded px-2 py-1 text-left hover:bg-white"
                >
                  <span className="font-semibold text-brand-700">{a.role}</span> — {a.email} / {a.password}
                </button>
              ))}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
