import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, ArrowLeft, Menu, X } from 'lucide-react';

export const AdminLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const menuItems = [
    { label: 'Room Operations', icon: LayoutDashboard, path: '/admin' },
    { label: 'User Directory', icon: Users, path: '/admin/users' },
  ];

  return (
    <div className="min-h-screen bg-[#050505] flex flex-col lg:flex-row">
      {/* Mobile Header */}
      <header className="lg:hidden bg-black border-b border-white/10 p-4 flex items-center justify-between sticky top-0 z-50">
        <Link to="/" className="text-xl font-black bg-gradient-to-r from-emerald-400 to-blue-500 bg-clip-text text-transparent">
          Synora
        </Link>
        <button 
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 text-gray-400 hover:text-white transition-colors"
        >
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </header>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black/95 pt-20 px-6 space-y-4">
          {menuItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setIsMobileMenuOpen(false)}
              className={`flex items-center gap-4 p-4 rounded-2xl text-lg font-bold transition-all ${
                location.pathname === item.path 
                  ? 'bg-emerald-600 text-white' 
                  : 'text-gray-500'
              }`}
            >
              <item.icon size={24} />
              {item.label}
            </Link>
          ))}
          <div className="pt-8 border-t border-white/10">
            <Link to="/" className="flex items-center gap-2 text-gray-500 font-bold">
              <ArrowLeft size={20} /> Back to Watch Party Site
            </Link>
          </div>
        </div>
      )}

      {/* Sidebar (Desktop) */}
      <aside className="w-64 bg-black border-r border-white/10 hidden lg:flex flex-col sticky top-0 h-screen">
        <div className="p-8">
          <Link to="/" className="text-2xl font-black bg-gradient-to-r from-emerald-400 to-blue-500 bg-clip-text text-transparent">
            Synora
          </Link>
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em] mt-2">Watch Party Admin</p>
        </div>

        <nav className="flex-1 px-4 space-y-2">
          {menuItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${
                location.pathname === item.path 
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/20' 
                  : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
              }`}
            >
              <item.icon size={20} />
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="p-6 border-t border-white/5">
          <Link to="/" className="flex items-center gap-2 text-gray-500 hover:text-white transition-colors text-sm font-bold">
            <ArrowLeft size={16} /> Back to Site
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-6 lg:p-12 overflow-y-auto">
        {children}
      </main>
    </div>
  );
};
