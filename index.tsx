
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import Admin from './components/Admin';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider } from './contexts/AuthContext';
import { ProfileProvider } from './contexts/ProfileContext';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
const isAdminRoute = window.location.pathname === '/admin' || window.location.pathname.startsWith('/admin/');
root.render(
  <React.StrictMode>
    <AuthProvider>
      <ProfileProvider>
        <ThemeProvider>
          {isAdminRoute ? (import.meta.env.DEV ? <Admin /> : <App />) : <App />}
        </ThemeProvider>
      </ProfileProvider>
    </AuthProvider>
  </React.StrictMode>
);
