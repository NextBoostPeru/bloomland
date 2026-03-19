import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Package, 
  Users, 
  Truck, 
  DollarSign, 
  Settings, 
  LogOut, 
  Store,
  Baby,
  ChevronLeft,
  ChevronRight,
  Shield,
  BarChart3,
  FileText
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const Sidebar = () => {
  const location = useLocation();
  const { logout, user } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const canAccessCRM = ['Administrador', 'Supervisor', 'Cajero', 'Vendedor'].includes(user?.role);

  const allMenuItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard', roles: ['Administrador', 'Supervisor', 'Cajero', 'Almacén', 'Vendedor'] },
    { icon: Store, label: 'Punto de Venta', path: '/pos', roles: ['Administrador', 'Supervisor', 'Cajero', 'Vendedor'] },
    { icon: FileText, label: 'Historial Ventas', path: '/sales', roles: ['Administrador', 'Supervisor', 'Cajero', 'Vendedor'] },
    { icon: Package, label: 'Inventario', path: '/inventory', roles: ['Administrador', 'Supervisor', 'Almacén'] },
    { icon: Users, label: 'Clientes', path: '/customers', roles: ['Administrador', 'Supervisor', 'Cajero', 'Vendedor'] },
    { icon: Truck, label: 'Proveedores', path: '/suppliers', roles: ['Administrador', 'Supervisor', 'Almacén'] },
    { icon: Package, label: 'Compras', path: '/purchases', roles: ['Administrador', 'Supervisor', 'Almacén'] },
    { icon: Truck, label: 'Logística', path: '/logistics', roles: ['Administrador', 'Supervisor', 'Almacén'] },
    { icon: DollarSign, label: 'Finanzas', path: '/finance', roles: ['Administrador', 'Supervisor'] },
    { icon: BarChart3, label: 'Reportes', path: '/reports', roles: ['Administrador', 'Supervisor'] },
    { icon: Shield, label: 'Seguridad', path: '/security', roles: ['Administrador'] },
    { icon: Settings, label: 'Configuración', path: '/settings', roles: ['Administrador'] },
  ];

  const menuItems = allMenuItems.filter(item => {
    if (!user?.role) return false;
    return item.roles.includes(user.role);
  });

  const isActive = (path) => location.pathname === path;

  const toggleSidebar = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    document.documentElement.style.setProperty('--sidebar-width', newState ? '5rem' : '16rem');
  };

  // Set initial width
  if (typeof document !== 'undefined') {
      document.documentElement.style.setProperty('--sidebar-width', isCollapsed ? '5rem' : '16rem');
  }

  return (
    <div 
      className={`h-screen bg-slate-900 text-white flex flex-col fixed left-0 top-0 shadow-2xl z-40 transition-all duration-300 ${isCollapsed ? 'w-20' : 'w-64'}`}
    >
      {/* Toggle Button */}
      <button 
        onClick={toggleSidebar}
        className="absolute -right-4 top-12 bg-indigo-600 rounded-full p-1.5 text-white shadow-lg border-2 border-slate-900 hover:bg-indigo-500 transition-all z-50 focus:outline-none hover:scale-110 active:scale-95 cursor-pointer flex items-center justify-center w-8 h-8"
        style={{ marginRight: '-1px' }}
      >
        {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
      </button>

      {/* Logo Area */}
      <div className={`p-6 flex items-center gap-3 border-b border-slate-800 transition-all ${isCollapsed ? 'justify-center px-2' : ''}`}>
        <div className="bg-indigo-600 p-2 rounded-lg shrink-0">
          <Baby className="w-6 h-6 text-white" />
        </div>
        <div className={`overflow-hidden transition-all duration-300 ${isCollapsed ? 'w-0 opacity-0 hidden' : 'w-auto opacity-100'}`}>
          <h1 className="font-bold text-lg tracking-wide whitespace-nowrap">BLOOMLAND</h1>
          <p className="text-xs text-slate-400 tracking-wider whitespace-nowrap">ERP SYSTEM</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-6 px-3 space-y-1 overflow-y-auto custom-scrollbar overflow-x-hidden">
        {menuItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            title={isCollapsed ? item.label : ''}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group whitespace-nowrap ${
              isActive(item.path)
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/50'
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            } ${isCollapsed ? 'justify-center px-2' : ''}`}
          >
            <item.icon 
              className={`w-5 h-5 shrink-0 transition-colors ${
                isActive(item.path) ? 'text-white' : 'text-slate-500 group-hover:text-white'
              }`} 
            />
            <span className={`font-medium text-sm transition-all duration-300 ${isCollapsed ? 'w-0 opacity-0 hidden' : 'w-auto opacity-100'}`}>
              {item.label}
            </span>
          </Link>
        ))}
      </nav>

      {/* Footer Actions */}
      <div className="p-4 border-t border-slate-800 space-y-3">
        <a 
          href="https://bloomland.com.pe/tienda/" 
          target="_blank" 
          rel="noopener noreferrer"
          className={`w-full flex items-center gap-2 py-2.5 px-4 border border-teal-500/30 text-teal-400 rounded-xl hover:bg-teal-500/10 transition-colors text-sm font-medium whitespace-nowrap ${isCollapsed ? 'justify-center px-0' : 'justify-center'}`}
        >
          <Store className="w-4 h-4 shrink-0" />
          <span className={`${isCollapsed ? 'hidden' : 'block'}`}>Catálogo</span>
        </a>
        
        <button 
          onClick={logout}
          className={`w-full flex items-center gap-3 px-4 py-2.5 text-slate-400 hover:text-red-400 hover:bg-red-500/5 rounded-xl transition-colors text-sm whitespace-nowrap ${isCollapsed ? 'justify-center' : 'justify-start'}`}
        >
          <LogOut className="w-5 h-5 hrink-0" />
          <span className={`${isCollapsed ? 'hidden' : 'block'}`}>Salir</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
