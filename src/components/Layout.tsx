import { ReactNode, useState } from 'react';
import {
  LayoutDashboard, Users, LogOut, HeartHandshake,
  Menu, X, Building2, ShieldCheck, Briefcase,
  Kanban, Bell, UserCog, TrendingUp,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface LayoutProps {
  children: ReactNode;
  currentView: string;
  onViewChange: (view: string) => void;
}

export function Layout({ children, currentView, onViewChange }: LayoutProps) {
  const { signOut, profile, isAdmin } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const menuItems = [
    { id: 'dashboard',  label: 'Dashboard',   icon: LayoutDashboard, desc: 'Resumen general' },
    { id: 'leads',      label: 'Leads',        icon: Users,           desc: 'Clientes activos' },
    { id: 'kanban',     label: 'Pipeline',     icon: Kanban,          desc: 'Vista kanban' },
    { id: 'comisiones', label: 'Comisiones',   icon: TrendingUp,      desc: 'Cobros y adelantos' },
    ...(isAdmin ? [
      { id: 'hogares',  label: 'Hogares',  icon: Building2, desc: 'Catálogo' },
      { id: 'usuarios', label: 'Usuarios', icon: UserCog,   desc: 'Equipo' },
    ] : []),
  ];

  const rolLabel = profile?.rol === 'administrador'
    ? 'Administrador'
    : profile?.rol === 'ejecutivo_comercial'
    ? 'Ejecutivo comercial'
    : 'Usuario';

  const RolIcon = profile?.rol === 'administrador' ? ShieldCheck : Briefcase;

  const initials = profile?.nombre_completo
    ? profile.nombre_completo.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
    : 'UD';

  const handleNavClick = (id: string) => {
    onViewChange(id);
    setSidebarOpen(false);
  };

  return (
    <div className="min-h-screen bg-cream-100 flex">

      {/* Backdrop (mobile overlay) */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full z-30 flex flex-col transition-transform duration-300 w-64 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0`}
        style={{ background: 'linear-gradient(180deg, #213521 0%, #315031 55%, #3d653d 100%)', boxShadow: '2px 0 20px rgba(0,0,0,0.15)' }}
      >
        <div className="px-6 pt-6 pb-5 border-b border-white/10 flex-shrink-0 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #e4ae3a, #d4951f)' }}>
              <HeartHandshake className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="font-display text-white text-base leading-tight">Vínculo Dorado</h2>
              <p className="text-white/40 text-xs mt-0.5">CRM Gerontológico</p>
            </div>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 overflow-y-auto">
          <p className="text-white/30 text-xs font-semibold uppercase tracking-wider px-3 mb-3">Menú</p>
          <ul className="space-y-1">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentView === item.id;
              return (
                <li key={item.id}>
                  <button
                    onClick={() => handleNavClick(item.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 group ${
                      isActive
                        ? 'text-white border border-white/10'
                        : 'text-white/60 hover:text-white hover:bg-white/8 border border-transparent'
                    }`}
                    style={isActive ? { background: 'rgba(228,174,58,0.18)' } : undefined}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all ${
                      isActive ? '' : 'bg-white/5 group-hover:bg-white/10'
                    }`} style={isActive ? { background: 'rgba(228,174,58,0.25)' } : undefined}>
                      <Icon className={`w-4 h-4 ${isActive ? 'text-yellow-300' : ''}`} />
                    </div>
                    <div className="text-left min-w-0">
                      <p className="text-sm font-semibold leading-none">{item.label}</p>
                      <p className={`text-xs mt-0.5 ${isActive ? 'text-yellow-300/60' : 'text-white/30'}`}>{item.desc}</p>
                    </div>
                    {isActive && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-yellow-300 flex-shrink-0" />}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="px-3 pb-4 pt-3 border-t border-white/10 flex-shrink-0">
          <div className="flex items-center gap-3 px-2 py-2 mb-1">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-xs font-bold flex-shrink-0 border-2"
              style={{ background: 'linear-gradient(135deg, #d4951f, #b87616)', borderColor: 'rgba(228,174,58,0.4)' }}>
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-white truncate leading-tight">{profile?.nombre_completo ?? 'Usuario'}</p>
              <div className="flex items-center gap-1 mt-0.5">
                <RolIcon className="w-3 h-3 text-white/30 flex-shrink-0" />
                <p className="text-xs text-white/40 truncate">{rolLabel}</p>
              </div>
            </div>
          </div>
          <button
            onClick={() => signOut()}
            className="w-full flex items-center gap-3 px-3 py-2 text-white/40 hover:text-red-300 hover:bg-red-900/20 rounded-xl transition-all duration-150"
          >
            <LogOut className="w-4 h-4" />
            <span className="text-sm">Cerrar sesión</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-h-screen lg:ml-64">
        {/* Top header */}
        <header className="bg-white border-b border-cream-200 sticky top-0 z-20 flex-shrink-0" style={{ boxShadow: '0 1px 6px rgba(0,0,0,0.05)' }}>
          <div className="px-4 sm:px-5 h-14 flex items-center justify-between">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 hover:bg-cream-100 rounded-lg transition text-sage-600"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-3">
              <button className="p-2 hover:bg-cream-100 rounded-lg transition text-sage-500">
                <Bell className="w-4 h-4" />
              </button>
              <div className="text-right hidden sm:block">
                <p className="text-sm font-semibold text-sage-900 leading-tight">{profile?.nombre_completo ?? 'Usuario'}</p>
                <p className="text-xs text-sage-500">{rolLabel}</p>
              </div>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                style={{ background: 'linear-gradient(135deg, #d4951f, #b87616)' }}>
                {initials}
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-5 lg:p-6 pb-20 lg:pb-6">
          {children}
        </main>
      </div>

      {/* Bottom navigation — mobile only */}
      <nav
        className="fixed bottom-0 left-0 right-0 lg:hidden z-20 flex border-t border-cream-200"
        style={{ background: 'linear-gradient(180deg, #213521 0%, #315031 100%)' }}
      >
        {menuItems.slice(0, 5).map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => handleNavClick(item.id)}
              className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-all active:scale-95 ${
                isActive ? 'text-yellow-300' : 'text-white/50'
              }`}
              style={{ minHeight: 56 }}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              <span className="text-[10px] font-medium leading-none mt-0.5">{item.label}</span>
              {isActive && <span className="w-1 h-1 rounded-full bg-yellow-300 mt-0.5" />}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
