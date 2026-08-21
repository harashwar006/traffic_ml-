import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import type { CurrentState } from './types';
import { api } from './services/api';
import { Navbar } from './components/layout/Navbar';
import { Footer } from './components/layout/Footer';
import { Overview } from './pages/Overview';
import { LiveAnalysis } from './pages/LiveAnalysis';
import { Simulator } from './pages/Simulator';
import { History } from './pages/History';

export function App() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [state, setState] = useState<CurrentState>({
    status: 'READY',
    history: [],
  });
  const [isBackendConnected, setIsBackendConnected] = useState<boolean>(true);

  // Sync theme with html root
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const fetchTrafficState = async () => {
    try {
      const data = await api.getCurrentTraffic();
      setState(data);
      const health = await api.checkHealth();
      setIsBackendConnected(health.status === 'healthy');
    } catch {
      setIsBackendConnected(false);
    }
  };

  useEffect(() => {
    fetchTrafficState();
    const interval = setInterval(fetchTrafficState, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Router>
      <div className="app-container">
        <Navbar
          theme={theme}
          toggleTheme={toggleTheme}
          isBackendConnected={isBackendConnected}
          activeCamera={state.camera_id || 'cam_5'}
        />

        <main className="content-wrapper">
          <Routes>
            <Route path="/" element={<Overview state={state} onRunSimulation={fetchTrafficState} />} />
            <Route path="/live" element={<LiveAnalysis state={state} onRefresh={fetchTrafficState} />} />
            <Route path="/simulate" element={<Simulator state={state} onRefresh={fetchTrafficState} />} />
            <Route path="/history" element={<History state={state} />} />
          </Routes>
        </main>

        <Footer />
      </div>
    </Router>
  );
}

export default App;
