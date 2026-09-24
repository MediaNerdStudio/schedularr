import { NavLink, Outlet } from 'react-router-dom';
import {
  Radio, Music, LayoutGrid, Clock, CalendarDays,
  BarChart3, Layers, Shield, ListMusic, Blocks
} from 'lucide-react';

const NAV_ITEMS = [
  { to: '/', icon: Radio, label: 'Stations' },
  { to: '/library', icon: Music, label: 'Library' },
  { to: '/categories', icon: LayoutGrid, label: 'Categories' },
  { to: '/clocks', icon: Clock, label: 'Clocks' },
  { to: '/grids', icon: CalendarDays, label: 'Grids' },
  { to: '/blocks', icon: Blocks, label: 'Blocks' },
  { to: '/charts', icon: BarChart3, label: 'Charts' },
  { to: '/rules', icon: Shield, label: 'Rules' },
  { to: '/schedule', icon: ListMusic, label: 'Schedule' },
];

export default function Layout() {
  return (
    <div className="flex h-screen overflow-hidden bg-base-100">
      {/* Sidebar */}
      <aside className="w-56 flex-shrink-0 bg-base-200 border-r border-base-300 flex flex-col">
        <div className="p-4 border-b border-base-300">
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <Layers className="w-6 h-6 text-primary" />
            Schedularr
          </h1>
        </div>
        <nav className="flex-1 overflow-y-auto py-2">
          {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                  isActive
                    ? 'bg-primary/10 text-primary font-medium border-r-2 border-primary'
                    : 'text-base-content/70 hover:bg-base-300/50 hover:text-base-content'
                }`
              }
            >
              <Icon className="w-4 h-4" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-base-300 text-xs text-base-content/40">
          v1.0.0
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
