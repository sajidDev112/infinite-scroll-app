import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter, Route, Routes } from 'react-router';
import './fonts.js';
import './index.css';
import { initCustomFonts } from '@shared/react/customFonts.js';
import { api } from './api.js';
import HomePage from './pages/HomePage.jsx';
import ViewerPage from './pages/ViewerPage.jsx';

// Fonts uploaded in admin Settings; stories wait for the ones they use.
initCustomFonts(() => api.getFonts());

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <HashRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/story/:id" element={<ViewerPage />} />
        <Route path="*" element={<HomePage />} />
      </Routes>
    </HashRouter>
  </StrictMode>,
);
