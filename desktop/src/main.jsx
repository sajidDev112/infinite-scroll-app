import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter, Route, Routes } from 'react-router';
import './fonts.js';
import './index.css';
import HomePage from './pages/HomePage.jsx';
import ViewerPage from './pages/ViewerPage.jsx';

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
