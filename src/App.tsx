import { useEffect, useState } from 'react';
import { HashRouter, Routes, Route, useLocation } from 'react-router-dom';
import { purgeLeftovers, requestPersistentStorage, armDbResilience, ensureDbAlive } from './db';
import { noteFirstRun } from './lib/backup';
import { UndoProvider } from './lib/undo';
import { BottomNav } from './components/ui';
import Dashboard from './screens/Dashboard';
import Projects from './screens/Projects';
import ProjectView from './screens/ProjectView';
import TaskView from './screens/TaskView';
import ArchiveScreen from './screens/ArchiveScreen';
import HelpScreen from './screens/HelpScreen';
import SharePicker from './screens/SharePicker';
import Shopping from './screens/Shopping';
import GuideMe from './screens/GuideMe';
import Welcome from './screens/Welcome';

const WELCOME_KEY = 'welcome.done';

function Shell() {
  const location = useLocation();
  const hideNav = location.pathname.startsWith('/share');
  // every page opens at the top — never wherever the last one was scrolled to
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);
  return (
    <div className="app">
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/projects" element={<Projects />} />
        <Route path="/project/:id" element={<ProjectView />} />
        <Route path="/task/:id" element={<TaskView />} />
        <Route path="/shopping" element={<Shopping />} />
        <Route path="/guide" element={<GuideMe />} />
        <Route path="/archive" element={<ArchiveScreen />} />
        <Route path="/help" element={<HelpScreen />} />
        <Route path="/share" element={<SharePicker />} />
        <Route path="*" element={<Dashboard />} />
      </Routes>
      {!hideNav && <BottomNav />}
    </div>
  );
}

export default function App() {
  const [showWelcome, setShowWelcome] = useState(() => !localStorage.getItem(WELCOME_KEY));
  // bumped whenever the database connection had to be revived, so every
  // live query on screen resubscribes to the fresh connection
  const [dbEpoch, setDbEpoch] = useState(0);

  useEffect(() => {
    noteFirstRun();
    requestPersistentStorage();
    void purgeLeftovers();
    armDbResilience(() => setDbEpoch((e) => e + 1));

    // phones close the database while the app sleeps: on every wake-up,
    // check the connection and check for a newer version of the app
    const onWake = () => {
      if (document.visibilityState !== 'visible') return;
      void ensureDbAlive().then((result) => {
        if (result === 'reopened') setDbEpoch((e) => e + 1);
      });
      void navigator.serviceWorker?.getRegistration?.().then((reg) => reg?.update());
    };
    document.addEventListener('visibilitychange', onWake);
    window.addEventListener('pageshow', onWake);
    return () => {
      document.removeEventListener('visibilitychange', onWake);
      window.removeEventListener('pageshow', onWake);
    };
  }, []);

  return (
    <UndoProvider>
      <HashRouter>
        {showWelcome && (
          <Welcome
            onDone={() => {
              localStorage.setItem(WELCOME_KEY, '1');
              setShowWelcome(false);
            }}
          />
        )}
        <Shell key={dbEpoch} />
      </HashRouter>
    </UndoProvider>
  );
}
