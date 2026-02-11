import { NavLink, Outlet } from 'react-router-dom';
import { useSession, useLogout } from '../hooks/useAuth';

const navItems = [
  { to: '/', label: 'Comparisons' },
  { to: '/companies', label: 'Companies' },
  { to: '/import', label: 'Import' },
  { to: '/snapshots', label: 'History' },
];

const adminItems = [
  { to: '/users', label: 'Users' },
];

export default function Layout() {
  const { data: user } = useSession();
  const logout = useLogout();

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-8">
              <span className="text-lg font-bold text-gray-900">Rank*d</span>
              <nav className="flex gap-1">
                {navItems.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === '/'}
                    className={({ isActive }) =>
                      `px-3 py-2 text-sm font-medium rounded ${
                        isActive
                          ? 'bg-gray-100 text-gray-900'
                          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                      }`
                    }
                  >
                    {item.label}
                  </NavLink>
                ))}
                {user?.role === 'admin' &&
                  adminItems.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      className={({ isActive }) =>
                        `px-3 py-2 text-sm font-medium rounded ${
                          isActive
                            ? 'bg-gray-100 text-gray-900'
                            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                        }`
                      }
                    >
                      {item.label}
                    </NavLink>
                  ))}
              </nav>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">{user?.username}</span>
              <button
                onClick={() => logout.mutate()}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Outlet />
      </main>
    </div>
  );
}
