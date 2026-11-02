import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import { PlayerApp } from './player/PlayerApp';
import { FullscreenSpinner } from './components/Spinner';

const TeacherApp = lazy(() => import('./teacher/TeacherApp').then((m) => ({ default: m.TeacherApp })));

export function App() {
  return (
    <Routes>
      <Route
        path="/teacher/*"
        element={
          <Suspense fallback={<FullscreenSpinner />}>
            <TeacherApp />
          </Suspense>
        }
      />
      <Route path="*" element={<PlayerApp />} />
    </Routes>
  );
}
