import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import StationsPage from './pages/StationsPage';
import LibraryPage from './pages/LibraryPage';
import SongDetailPage from './pages/SongDetailPage';
import CategoriesPage from './pages/CategoriesPage';
import ClocksPage from './pages/ClocksPage';
import ClockEditorPage from './pages/ClockEditorPage';
import GridsPage from './pages/GridsPage';
import BlocksPage from './pages/BlocksPage';
import ChartsPage from './pages/ChartsPage';
import RulesPage from './pages/RulesPage';
import SchedulePage from './pages/SchedulePage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<StationsPage />} />
          <Route path="/library" element={<LibraryPage />} />
          <Route path="/library/:id" element={<SongDetailPage />} />
          <Route path="/categories" element={<CategoriesPage />} />
          <Route path="/clocks" element={<ClocksPage />} />
          <Route path="/clocks/:id" element={<ClockEditorPage />} />
          <Route path="/grids" element={<GridsPage />} />
          <Route path="/blocks" element={<BlocksPage />} />
          <Route path="/charts" element={<ChartsPage />} />
          <Route path="/rules" element={<RulesPage />} />
          <Route path="/schedule" element={<SchedulePage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
