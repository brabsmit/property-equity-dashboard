import { useState } from 'react';
import PasscodeGate from './components/PasscodeGate';
import Dashboard from './components/Dashboard';

function App() {
  const [authenticated, setAuthenticated] = useState(
    () => localStorage.getItem('dashboard_auth') === 'true'
  );

  if (!authenticated) {
    return <PasscodeGate onAuthenticated={() => setAuthenticated(true)} />;
  }

  return <Dashboard />;
}

export default App;
