
import React, { useState } from 'react';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const Layout: React.FC<LayoutProps> = ({ children, activeTab, setActiveTab }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: 'LayoutDashboard' },
    { id: 'clients', label: 'Clientes', icon: 'Users' },
    { id: 'services', label: 'Serviços', icon: 'Briefcase' },
    { id: 'materials', label: 'Materiais', icon: 'Box' },
    { id: 'budgets', label: 'Orçamentos', icon: 'FileText' },
    { id: 'tracking', label: 'Acompanhamento', icon: 'Clock' },
  ];

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden font-sans">
      {/* Sidebar Mobile Toggle */}
      <button 
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        className="lg:hidden fixed top-4 right-4 z-50 p-2 bg-indigo-600 text-white rounded-lg shadow-xl hover:bg-indigo-700 transition-all active:scale-95"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
        </svg>
      </button>

      {/* Sidebar Overlay for Mobile */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:relative lg:translate-x-0 transition-transform duration-300 ease-in-out z-40 w-68 bg-indigo-950 text-white shadow-2xl`}>
        <div className="p-8">
          <div className="flex flex-col">
            <h1 className="text-xl font-black tracking-tight text-white">Mixto de Tudo</h1>
            <div className="flex items-center gap-1 mt-1">
              <span className="h-1 w-8 bg-indigo-500 rounded-full"></span>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400">Pro Management</p>
            </div>
          </div>
        </div>
        
        <nav className="mt-4 px-3 space-y-1">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setActiveTab(item.id);
                setIsSidebarOpen(false);
              }}
              className={`w-full flex items-center px-5 py-3.5 rounded-xl transition-all duration-200 group ${
                activeTab === item.id 
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/50' 
                  : 'text-indigo-300 hover:bg-white/10 hover:text-white'
              }`}
            >
              <span className={`font-bold text-sm ${activeTab === item.id ? 'translate-x-1' : 'group-hover:translate-x-1'} transition-transform`}>
                {item.label}
              </span>
            </button>
          ))}
        </nav>

        <div className="absolute bottom-8 left-0 w-full px-8">
          <div className="p-4 bg-indigo-900/40 rounded-2xl border border-white/5">
            <p className="text-[10px] text-indigo-300 font-bold uppercase tracking-wider mb-1">Assinatura</p>
            <p className="text-xs font-bold text-white">Plano Premium Ativo</p>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        {/* Barra Superior (Top Bar) */}
        <header className="bg-white border-b border-gray-100 h-20 flex items-center justify-between px-8 shrink-0 z-20">
          <div className="flex items-center gap-4">
            <div className="flex flex-col md:flex-row md:items-center md:gap-4">
              <h1 className="text-lg font-black text-indigo-600 tracking-tighter leading-none">
                MIXTO DE TUDO SERVIÇOS
              </h1>
              <div className="hidden md:block h-6 w-px bg-gray-200"></div>
              <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest leading-none mt-1 md:mt-0">
                {menuItems.find(i => i.id === activeTab)?.label}
              </h2>
            </div>
          </div>
          
          <div className="hidden sm:flex items-center gap-4">
            <div className="text-right">
              <p className="text-xs font-black text-gray-800">Admin Mixto</p>
              <p className="text-[10px] font-bold text-emerald-500 uppercase">Online</p>
            </div>
            <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-black text-sm border-2 border-white shadow-sm">
              AM
            </div>
          </div>
        </header>
        
        <div className="flex-1 overflow-y-auto bg-[#F8FAFC]">
          <div className="max-w-[1600px] mx-auto p-6 md:p-10">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Layout;
