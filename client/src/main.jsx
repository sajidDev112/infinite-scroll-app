import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import './fonts.js';
import './index.css';
import { initCustomFonts } from '@shared/react/customFonts.js';
import { api } from './api.js';
import StoriesPage from './pages/StoriesPage.jsx';
import StoryPage from './pages/StoryPage.jsx';

// Fonts uploaded in admin Settings; stories wait for the ones they use.
initCustomFonts(() => api.getFonts());

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {/* Served under /client (vite base): /client/stories and /client/stories/:id */}
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
      <Routes>
        <Route path="/stories" element={<StoriesPage />} />
        <Route path="/stories/:id" element={<StoryPage />} />
        <Route path="*" element={<Navigate to="/stories" replace />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
