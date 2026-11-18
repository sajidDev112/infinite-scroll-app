import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import './fonts.js';
import './index.css';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { ToastProvider } from './context/ToastContext.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {/* Served under /admin (vite base). */}
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
      <ToastProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  </StrictMode>,
);
