import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Clock, User, LogOut, Users } from 'lucide-react';

function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isActive = (path) => location.pathname === path;

  return (
    <nav className="bg-white shadow-md">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          <Link to="/dashboard" className="flex items-center space-x-2">
            <Clock className="h-8 w-8 text-primary-600" />
            <span className="text-xl font-bold text-gray-900">FieldWork</span>
          </Link>

          <div className="flex items-center space-x-6">
            <Link
              to="/dashboard"
              className={`flex items-center space-x-1 px-3 py-2 rounded-md text-sm font-medium ${
                isActive('/dashboard')
                  ? 'bg-primary-100 text-primary-700'
                  : 'text-gray-700 hover:text-gray-900'
              }`}
            >
              <Clock className="h-4 w-4" />
              <span>Dashboard</span>
            </Link>

            <Link
              to="/work-session"
              className={`flex items-center space-x-1 px-3 py-2 rounded-md text-sm font-medium ${
                isActive('/work-session')
                  ? 'bg-primary-100 text-primary-700'
                  : 'text-gray-700 hover:text-gray-900'
              }`}
            >
              <span>Work Session</span>
            </Link>

            {user?.role === 'admin' && (
              <Link
                to="/admin"
                className={`flex items-center space-x-1 px-3 py-2 rounded-md text-sm font-medium ${
                  isActive('/admin')
                    ? 'bg-primary-100 text-primary-700'
                    : 'text-gray-700 hover:text-gray-900'
                }`}
              >
                <Users className="h-4 w-4" />
                <span>Admin</span>
              </Link>
            )}

            <div className="flex items-center space-x-3 border-l pl-6">
              <Link
                to="/profile"
                className="flex items-center space-x-2 text-gray-700 hover:text-gray-900"
              >
                <User className="h-5 w-5" />
                <span className="text-sm font-medium">{user?.name}</span>
              </Link>

              <button
                onClick={handleLogout}
                className="flex items-center space-x-1 text-gray-700 hover:text-red-600 transition-colors"
              >
                <LogOut className="h-4 w-4" />
                <span className="text-sm">Logout</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}

export default Navbar;
