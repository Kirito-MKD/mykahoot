import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { Logo } from '../components/Logo';
import { ToastLayer } from '../components/Toast';
import { TestsPage } from './TestsPage';
import { HistoryPage } from './HistoryPage';
import { HostGame } from './host/HostGame';
import { ResumeBanner } from './ResumeBanner';
import './teacher.css';

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="t-shell">
      <header className="t-top">
        <Logo size={38} light={false} />
        <nav className="t-nav" aria-label="Разделы">
          <NavLink to="/teacher" end>
            Мои тесты
          </NavLink>
          <NavLink to="/teacher/history">История игр</NavLink>
        </nav>
        <span className="t-top-hint">Экран преподавателя</span>
      </header>
      <ResumeBanner />
      <main className="t-main">{children}</main>
    </div>
  );
}

export function TeacherApp() {
  return (
    <>
      <Routes>
        <Route path="game" element={<HostGame />} />
        <Route
          path="history"
          element={
            <Shell>
              <HistoryPage />
            </Shell>
          }
        />
        <Route
          index
          element={
            <Shell>
              <TestsPage />
            </Shell>
          }
        />
        <Route path="*" element={<Navigate to="/teacher" replace />} />
      </Routes>
      <ToastLayer />
    </>
  );
}
