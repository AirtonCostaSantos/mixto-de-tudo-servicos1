import React, { useState, useEffect, useMemo } from 'react';
import Layout from './components/Layout';
import { 
  Client, 
  ServiceType, 
  Material, 
  Budget, 
  BudgetItem,
  ServiceStatus, 
  TaskStatus,
  ProjectTask,
  DashboardStats 
} from './types';
import { 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { generateBudgetSummaryText, openWhatsApp, generateBudgetPDF } from './services/pdfService';

// Keys para LocalStorage
const STORAGE_KEYS = {
  CLIENTS: 'mixto_clients',
  SERVICES: 'mixto_services',
  MATERIALS: 'mixto_materials',
  BUDGETS: 'mixto_budgets'
};

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // Estados com carregamento do LocalStorage
  const [clients, setClients] = useState<Client[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.CLIENTS);
    return saved ? JSON.parse(saved) : [
      { id: 'c1', name: 'Exemplo Cliente', email: 'contato@exemplo.com', phone: '11999999999', address: 'Rua Exemplo, 123', document: '123.456.789-00' }
    ];
  });

  const [services, setServices] = useState<ServiceType[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.SERVICES);
    return saved ? JSON.parse(saved) : [
      { id: 's1', name: 'Pintura Geral', description: 'Serviço de pintura completa', basePrice: 1500, unit: 'm²' }
    ];
  });

  const [materials, setMaterials] = useState<Material[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.MATERIALS);
    return saved ? JSON.parse(saved) : [
      { id: 'm1', name: 'Tinta Acrílica', unitPrice: 350, stock: 10, unit: 'un' }
    ];
  });

  const [budgets, setBudgets] = useState<Budget[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.BUDGETS);
    return saved ? JSON.parse(saved) : [];
  });

  const [expandedBudgetId, setExpandedBudgetId] = useState<string | null>(null);

  // Efeitos para salvar no LocalStorage sempre que houver mudanças
  useEffect(() => localStorage.setItem(STORAGE_KEYS.CLIENTS, JSON.stringify(clients)), [clients]);
  useEffect(() => localStorage.setItem(STORAGE_KEYS.SERVICES, JSON.stringify(services)), [services]);
  useEffect(() => localStorage.setItem(STORAGE_KEYS.MATERIALS, JSON.stringify(materials)), [materials]);
  useEffect(() => localStorage.setItem(STORAGE_KEYS.BUDGETS, JSON.stringify(budgets)), [budgets]);

  // Modals state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);

  const [tempBudgetItems, setTempBudgetItems] = useState<{
    services: BudgetItem[];
    materials: BudgetItem[];
  }>({ services: [], materials: [] });

  useEffect(() => {
    if (isModalOpen && activeTab === 'budgets') {
      if (editingItem) {
        setTempBudgetItems({
          services: editingItem.services || [],
          materials: editingItem.materials || []
        });
      } else {
        setTempBudgetItems({ services: [], materials: [] });
      }
    }
  }, [isModalOpen, activeTab, editingItem]);

  const stats: DashboardStats = useMemo(() => {
    return {
      totalClients: clients.length,
      totalBudgets: budgets.length,
      totalRevenue: budgets.reduce((acc, b) => acc + b.totalValue, 0),
      activeServices: budgets.filter(b => b.status === ServiceStatus.IN_PROGRESS || b.status === ServiceStatus.APPROVED).length,
    };
  }, [clients, budgets]);

  const chartData = useMemo(() => {
    if (budgets.length === 0) {
      return [
        { name: 'Jan', value: 0 }, { name: 'Fev', value: 0 }, { name: 'Mar', value: 0 },
        { name: 'Abr', value: 0 }, { name: 'Mai', value: 0 }, { name: 'Jun', value: 0 },
      ];
    }
    // Agrupa valores por mês para o gráfico
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const data = months.map(m => ({ name: m, value: 0 }));
    budgets.forEach(b => {
      const monthIdx = new Date(b.date).getMonth();
      data[monthIdx].value += b.totalValue;
    });
    return data;
  }, [budgets]);

  const generateBudgetId = () => {
    const currentYear = new Date().getFullYear();
    const yearBudgets = budgets.filter(b => b.id.endsWith(`/${currentYear}`));
    const nextNum = yearBudgets.length + 1;
    return `${nextNum.toString().padStart(3, '0')}/${currentYear}`;
  };

  const handleAddOrEdit = (type: string, data: any) => {
    let finalId = editingItem ? editingItem.id : Math.random().toString(36).substr(2, 9);
    
    if (type === 'budgets' && !editingItem) {
      finalId = generateBudgetId();
    }

    let finalData = { ...data, id: finalId };
    
    if (type === 'budgets') {
      finalData.services = tempBudgetItems.services;
      finalData.materials = tempBudgetItems.materials;
      finalData.tasks = editingItem?.tasks || [];
      finalData.totalValue = calculateTotal(tempBudgetItems.services, tempBudgetItems.materials);
    }

    if (type === 'clients') {
      setClients(prev => editingItem ? prev.map(c => c.id === finalId ? finalData : c) : [...prev, finalData]);
    } else if (type === 'services') {
      setServices(prev => editingItem ? prev.map(s => s.id === finalId ? finalData : s) : [...prev, finalData]);
    } else if (type === 'materials') {
      setMaterials(prev => editingItem ? prev.map(m => m.id === finalId ? finalData : m) : [...prev, finalData]);
    } else if (type === 'budgets') {
      setBudgets(prev => editingItem ? prev.map(b => b.id === finalId ? finalData : b) : [...prev, finalData]);
    }

    setIsModalOpen(false);
    setEditingItem(null);
  };

  const calculateTotal = (srvs: BudgetItem[], mats: BudgetItem[]) => {
    const srvTotal = srvs.reduce((acc, item) => acc + (item.unitPrice * item.quantity), 0);
    const matTotal = mats.reduce((acc, item) => acc + (item.unitPrice * item.quantity), 0);
    return srvTotal + matTotal;
  };

  const currentTotal = useMemo(() => calculateTotal(tempBudgetItems.services, tempBudgetItems.materials), [tempBudgetItems]);

  const handleApproveBudget = (id: string) => {
    setBudgets(prev => prev.map(b => b.id === id ? { ...b, status: ServiceStatus.APPROVED } : b));
  };

  const updateTaskStatus = (budgetId: string, taskId: string, newStatus: TaskStatus) => {
    setBudgets(prev => prev.map(b => {
      if (b.id === budgetId) {
        return {
          ...b,
          tasks: b.tasks.map(t => t.id === taskId ? { ...t, status: newStatus } : t)
        };
      }
      return b;
    }));
  };

  const addTaskToBudget = (budgetId: string, stage: 'Planejamento' | 'Execução', description: string) => {
    if (!description.trim()) return;
    const newTask: ProjectTask = {
      id: Math.random().toString(36).substr(2, 9),
      description,
      stage,
      status: TaskStatus.PENDING
    };
    setBudgets(prev => prev.map(b => b.id === budgetId ? { ...b, tasks: [...b.tasks, newTask] } : b));
  };

  const removeTaskFromBudget = (budgetId: string, taskId: string) => {
    if (!confirm('Deseja remover esta etapa?')) return;
    setBudgets(prev => prev.map(b => b.id === budgetId ? { ...b, tasks: b.tasks.filter(t => t.id !== taskId) } : b));
  };

  const addBudgetItem = (type: 'services' | 'materials') => {
    const newItem: BudgetItem = { id: '', quantity: 1, unitPrice: 0 };
    setTempBudgetItems(prev => ({ ...prev, [type]: [...prev[type], newItem] }));
  };

  const removeBudgetItem = (type: 'services' | 'materials', index: number) => {
    setTempBudgetItems(prev => ({ ...prev, [type]: prev[type].filter((_, i) => i !== index) }));
  };

  const updateBudgetItem = (type: 'services' | 'materials', index: number, field: keyof BudgetItem, value: any) => {
    setTempBudgetItems(prev => {
      const newList = [...prev[type]];
      const updatedItem = { ...newList[index], [field]: value };
      if (field === 'id') {
        const source = type === 'services' ? services : materials;
        const found = source.find(s => s.id === value);
        if (found) updatedItem.unitPrice = 'basePrice' in found ? found.basePrice : found.unitPrice;
      }
      newList[index] = updatedItem;
      return { ...prev, [type]: newList };
    });
  };

  const renderDashboard = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Clientes Ativos', value: stats.totalClients },
          { label: 'Total Orçamentos', value: stats.totalBudgets },
          { label: 'Receita Total', value: `R$ ${stats.totalRevenue.toLocaleString()}` },
          { label: 'Serviços Ativos', value: stats.activeServices },
        ].map((stat, i) => (
          <div key={i} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col group hover:border-indigo-200 transition-colors">
            <span className="text-sm font-medium text-gray-400 uppercase tracking-wider">{stat.label}</span>
            <span className="text-2xl font-black text-gray-900 mt-2">{stat.value}</span>
          </div>
        ))}
      </div>
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
        <h3 className="text-lg font-black text-gray-800 mb-8 flex items-center gap-2">
          <span className="w-1.5 h-6 bg-indigo-600 rounded-full"></span>
          DESEMPENHO FINANCEIRO ANUAL
        </h3>
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.1}/>
                  <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 11}} dy={10} />
              <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 11}} tickFormatter={(v) => `R$ ${v}`} />
              <Tooltip 
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontWeight: 'bold' }}
                formatter={(v) => [`R$ ${Number(v).toLocaleString()}`, 'Valor']}
              />
              <Area type="monotone" dataKey="value" stroke="#4f46e5" strokeWidth={4} fillOpacity={1} fill="url(#colorValue)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );

  const renderClients = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest">Base de Clientes</h2>
        <button onClick={() => { setEditingItem(null); setIsModalOpen(true); }} className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-black transition text-xs shadow-lg shadow-indigo-100 flex items-center gap-2">
          <span className="text-lg">+</span> NOVO CLIENTE
        </button>
      </div>
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-50/50 border-b border-gray-100">
            <tr><th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Identificação</th><th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Contato</th><th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Ações</th></tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {clients.map(client => (
              <tr key={client.id} className="hover:bg-indigo-50/30 transition group">
                <td className="px-6 py-5">
                  <div className="font-bold text-gray-800 group-hover:text-indigo-600 transition-colors">{client.name}</div>
                  <div className="text-xs text-gray-400 font-mono mt-0.5">{client.document || 'Sem CPF/CNPJ'}</div>
                </td>
                <td className="px-6 py-5">
                  <div className="text-sm font-semibold text-gray-600">{client.phone}</div>
                  <div className="text-xs text-gray-400 truncate max-w-[200px]">{client.email}</div>
                </td>
                <td className="px-6 py-5 text-right">
                  <button onClick={() => { setEditingItem(client); setIsModalOpen(true); }} className="text-indigo-600 hover:text-indigo-900 font-black text-xs px-3 py-1.5 rounded-lg border border-transparent hover:border-indigo-100 hover:bg-white transition-all">EDITAR</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderBudgets = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest">Orçamentos Gerados</h2>
        <button onClick={() => { setEditingItem(null); setIsModalOpen(true); }} className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-black transition text-xs shadow-lg shadow-indigo-100 flex items-center gap-2">
          <span className="text-lg">+</span> NOVO ORÇAMENTO
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {budgets.map(budget => {
          const client = clients.find(c => c.id === budget.clientId);
          return (
            <div key={budget.id} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col hover:shadow-xl hover:scale-[1.02] transition-all duration-300">
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-1.5 h-4 bg-indigo-500 rounded-full"></span>
                    <h4 className="font-black text-gray-900 truncate leading-tight">{client?.name || 'Cliente Desconhecido'}</h4>
                  </div>
                  <div className="text-[10px] text-indigo-500 font-black tracking-widest uppercase mb-1">Cód. {budget.id}</div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">{new Date(budget.date).toLocaleDateString('pt-BR', { dateStyle: 'long' })}</span>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider shadow-sm ${
                  budget.status === ServiceStatus.COMPLETED ? 'bg-emerald-500 text-white' : 
                  budget.status === ServiceStatus.APPROVED ? 'bg-indigo-600 text-white' :
                  budget.status === ServiceStatus.IN_PROGRESS ? 'bg-blue-500 text-white' : 
                  budget.status === ServiceStatus.CANCELED ? 'bg-rose-500 text-white' :
                  'bg-gray-100 text-gray-500'
                }`}>{budget.status}</span>
              </div>
              
              <div className="bg-indigo-50/50 rounded-xl p-4 mb-6">
                <div className="text-[9px] font-black text-indigo-400 uppercase mb-1">Investimento Total</div>
                <div className="text-2xl font-black text-indigo-700 leading-none">R$ {budget.totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
              </div>

              <div className="mt-auto grid grid-cols-2 gap-2 pt-4 border-t border-gray-50">
                {budget.status === ServiceStatus.PENDING && (
                  <button onClick={() => handleApproveBudget(budget.id)} className="col-span-2 bg-indigo-600 text-white py-3 rounded-xl text-xs font-black hover:bg-indigo-700 transition shadow-lg shadow-indigo-100 mb-2">APROVAR ORÇAMENTO</button>
                )}
                <button onClick={() => openWhatsApp(client?.phone || '', generateBudgetSummaryText(budget, client, services, materials))} className="flex items-center justify-center gap-2 bg-emerald-50 text-emerald-700 py-3 rounded-xl text-[10px] font-black hover:bg-emerald-100 transition border border-emerald-100">WHATSAPP</button>
                <button onClick={() => generateBudgetPDF(budget, client, services, materials)} className="flex items-center justify-center gap-2 bg-indigo-50 text-indigo-700 py-3 rounded-xl text-[10px] font-black hover:bg-indigo-100 transition border border-indigo-100">GERAR PDF</button>
                <button onClick={() => { setEditingItem(budget); setIsModalOpen(true); }} className="col-span-2 mt-2 py-2 text-[10px] font-black text-gray-400 hover:text-indigo-600 transition text-center uppercase tracking-widest underline decoration-indigo-100 underline-offset-4">Editar Detalhes</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderTracking = () => (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      {[ServiceStatus.PENDING, ServiceStatus.APPROVED, ServiceStatus.IN_PROGRESS, ServiceStatus.COMPLETED].map(status => (
        <div key={status} className="bg-gray-50/80 p-4 rounded-3xl min-h-[600px] border border-gray-200/60 shadow-inner">
          <div className="flex items-center justify-between mb-6 px-1">
            <h3 className="font-black text-gray-800 text-[10px] uppercase tracking-[0.2em] flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full shadow-sm ${
                status === ServiceStatus.COMPLETED ? 'bg-emerald-500 animate-pulse' : 
                status === ServiceStatus.IN_PROGRESS ? 'bg-blue-500' : 
                status === ServiceStatus.APPROVED ? 'bg-indigo-600' : 'bg-amber-400'
              }`}></span>
              {status}
            </h3>
            <span className="text-[10px] font-bold text-gray-400 bg-white px-2 py-1 rounded-full border border-gray-100">
              {budgets.filter(b => b.status === status).length}
            </span>
          </div>

          <div className="space-y-5">
            {budgets.filter(b => b.status === status).map(budget => {
              const isExpanded = expandedBudgetId === budget.id;
              const completedTasks = budget.tasks.filter(t => t.status === TaskStatus.COMPLETED).length;
              const progress = budget.tasks.length > 0 ? (completedTasks / budget.tasks.length) * 100 : 0;

              return (
                <div key={budget.id} className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden transition-all hover:shadow-md hover:border-indigo-100">
                  <div className="p-5">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <div className="text-[9px] text-indigo-500 font-black tracking-widest mb-1 uppercase">Projeto {budget.id}</div>
                        <p className="font-black text-gray-900 text-sm leading-tight">{clients.find(c => c.id === budget.clientId)?.name}</p>
                      </div>
                    </div>
                    
                    <div className="mt-4">
                      <div className="flex justify-between items-center text-[9px] font-black text-gray-400 mb-1.5 uppercase tracking-wider">
                        <span>CONCLUÍDO</span>
                        <span className={progress === 100 ? 'text-emerald-500' : 'text-indigo-600'}>{Math.round(progress)}%</span>
                      </div>
                      <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden shadow-inner">
                        <div className={`h-full transition-all duration-1000 ease-out ${progress === 100 ? 'bg-emerald-500' : 'bg-indigo-600 shadow-lg shadow-indigo-100'}`} style={{ width: `${progress}%` }} />
                      </div>
                    </div>

                    <div className="mt-5 space-y-2">
                      <label className="text-[8px] font-black text-gray-400 uppercase tracking-widest px-1">Mudar Status</label>
                      <select value={budget.status} onChange={(e) => setBudgets(prev => prev.map(b => b.id === budget.id ? { ...b, status: e.target.value as ServiceStatus } : b))} className="w-full text-[10px] border border-gray-200 rounded-xl p-2 bg-gray-50/50 font-black border-gray-200 outline-none focus:ring-2 focus:ring-indigo-100 transition-all cursor-pointer">
                        <option value={ServiceStatus.PENDING}>Pendente</option>
                        <option value={ServiceStatus.APPROVED}>Aprovado</option>
                        <option value={ServiceStatus.IN_PROGRESS}>Em Andamento</option>
                        <option value={ServiceStatus.COMPLETED}>Concluído</option>
                        <option value={ServiceStatus.CANCELED}>Cancelado</option>
                      </select>
                    </div>

                    <button onClick={() => setExpandedBudgetId(isExpanded ? null : budget.id)} className={`mt-3 w-full text-[9px] font-black flex items-center justify-center gap-1.5 py-2.5 border rounded-xl transition-all ${isExpanded ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-100' : 'bg-indigo-50/50 text-indigo-600 border-indigo-100 hover:bg-indigo-100'}`}>
                      {isExpanded ? 'FECHAR DETALHES' : 'GERENCIAR ETAPAS'}
                    </button>
                  </div>

                  {isExpanded && (
                    <div className="bg-indigo-50/30 border-t border-indigo-100 p-5 space-y-6 animate-in slide-in-from-top-2 duration-300">
                      {(['Planejamento', 'Execução'] as const).map(stage => (
                        <div key={stage} className="space-y-3">
                          <div className="flex justify-between items-center border-b border-indigo-100 pb-1.5">
                            <h4 className="text-[9px] font-black text-indigo-400 uppercase tracking-[0.15em]">{stage}</h4>
                            <span className="text-[9px] text-white bg-indigo-400 px-2 py-0.5 rounded-full font-black">
                              {budget.tasks.filter(t => t.stage === stage && t.status === TaskStatus.COMPLETED).length}/{budget.tasks.filter(t => t.stage === stage).length}
                            </span>
                          </div>
                          <div className="space-y-2.5">
                            {budget.tasks.filter(t => t.stage === stage).map(task => (
                              <div key={task.id} className="bg-white p-3.5 rounded-2xl border border-indigo-50 shadow-sm group hover:border-indigo-200 transition-all">
                                <div className="flex justify-between items-start mb-3">
                                  <p className="text-[11px] text-gray-700 font-bold leading-tight group-hover:text-indigo-900">{task.description}</p>
                                  <button onClick={() => removeTaskFromBudget(budget.id, task.id)} className="text-gray-300 hover:text-rose-500 text-sm leading-none opacity-0 group-hover:opacity-100 transition-all">&times;</button>
                                </div>
                                <div className="flex gap-1.5">
                                  <button onClick={() => updateTaskStatus(budget.id, task.id, TaskStatus.COMPLETED)} className={`flex-1 text-[8px] font-black py-2 rounded-lg transition-all ${task.status === TaskStatus.COMPLETED ? 'bg-emerald-500 text-white shadow-md shadow-emerald-100 scale-95' : 'bg-gray-100 text-gray-400 hover:bg-emerald-50 hover:text-emerald-600'}`}>CONCLUÍDO</button>
                                  <button onClick={() => updateTaskStatus(budget.id, task.id, TaskStatus.DELAYED)} className={`flex-1 text-[8px] font-black py-2 rounded-lg transition-all ${task.status === TaskStatus.DELAYED ? 'bg-rose-500 text-white shadow-md shadow-rose-100 scale-95' : 'bg-gray-100 text-gray-400 hover:bg-rose-50 hover:text-rose-600'}`}>ATRASADO</button>
                                  <button onClick={() => updateTaskStatus(budget.id, task.id, TaskStatus.PENDING)} className={`px-3 text-[9px] font-black rounded-lg transition-all ${task.status === TaskStatus.PENDING ? 'bg-amber-400 text-white shadow-md shadow-amber-100' : 'bg-gray-100 text-gray-400'}`} title="Pendente">!</button>
                                </div>
                              </div>
                            ))}
                            
                            <div className="flex gap-2 pt-2">
                              <input 
                                type="text" 
                                placeholder="Descrever nova etapa..." 
                                className="flex-1 text-[10px] p-2.5 border-2 border-transparent rounded-xl bg-white shadow-sm outline-none focus:border-indigo-300 transition-all font-semibold" 
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    addTaskToBudget(budget.id, stage, e.currentTarget.value);
                                    e.currentTarget.value = '';
                                  }
                                }}
                              />
                              <button 
                                onClick={(e) => {
                                  const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                                  addTaskToBudget(budget.id, stage, input.value);
                                  input.value = '';
                                }}
                                className="bg-indigo-600 text-white w-10 h-10 rounded-xl font-black hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100 shrink-0"
                              >+</button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            
            {budgets.filter(b => b.status === status).length === 0 && (
              <div className="py-10 text-center space-y-2">
                <div className="text-3xl grayscale opacity-20">📂</div>
                <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest">Nenhum serviço</p>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <Layout activeTab={activeTab} setActiveTab={setActiveTab}>
      {activeTab === 'dashboard' && renderDashboard()}
      {activeTab === 'clients' && renderClients()}
      {activeTab === 'services' && <ManagementList title="Serviços" items={services} onAdd={() => { setEditingItem(null); setIsModalOpen(true); }} onEdit={(s) => { setEditingItem(s); setIsModalOpen(true); }} />}
      {activeTab === 'materials' && <ManagementList title="Materiais" items={materials} onAdd={() => { setEditingItem(null); setIsModalOpen(true); }} onEdit={(m) => { setEditingItem(m); setIsModalOpen(true); }} />}
      {activeTab === 'budgets' && renderBudgets()}
      {activeTab === 'tracking' && renderTracking()}

      {isModalOpen && (
        <div className="fixed inset-0 bg-indigo-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] w-full max-w-4xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh] border border-white/20 animate-in zoom-in-95 duration-300">
            <div className="p-8 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="text-xl font-black text-gray-800 tracking-tight flex items-center gap-3">
                <span className="w-2 h-8 bg-indigo-600 rounded-full"></span>
                {editingItem ? 'EDITAR' : 'NOVO'} {activeTab.toUpperCase().slice(0, -1)}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="w-10 h-10 rounded-full bg-white border border-gray-100 text-gray-400 hover:text-rose-500 hover:shadow-md transition-all text-2xl font-light">&times;</button>
            </div>
            
            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              const data: any = {};
              formData.forEach((v, k) => data[k] = ['basePrice', 'unitPrice', 'stock'].includes(k) ? Number(v) : v);
              if (activeTab === 'budgets') {
                data.date = editingItem?.date || new Date().toISOString();
                data.status = editingItem?.status || ServiceStatus.PENDING;
              }
              handleAddOrEdit(activeTab, data);
            }} className="flex-1 overflow-y-auto p-8 lg:p-12 space-y-10">
              {activeTab === 'clients' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <Input label="Nome Completo" name="name" defaultValue={editingItem?.name} required />
                  <Input label="CPF ou CNPJ" name="document" defaultValue={editingItem?.document} />
                  <Input label="E-mail" name="email" type="email" defaultValue={editingItem?.email} />
                  <Input label="Telefone" name="phone" defaultValue={editingItem?.phone} required />
                  <div className="md:col-span-2"><Input label="Endereço Completo" name="address" defaultValue={editingItem?.address} /></div>
                </div>
              )}
              
              {activeTab === 'services' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <Input label="Nome do Serviço" name="name" defaultValue={editingItem?.name} required />
                  <div className="flex gap-4">
                    <Input label="Preço Base (R$)" name="basePrice" type="number" step="0.01" defaultValue={editingItem?.basePrice} required />
                    <Input label="Unidade" name="unit" defaultValue={editingItem?.unit} required />
                  </div>
                  <div className="md:col-span-2 flex flex-col gap-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Descrição Detalhada</label>
                    <textarea name="description" defaultValue={editingItem?.description} className="border-2 border-gray-100 rounded-2xl p-4 focus:ring-4 focus:ring-indigo-50 focus:border-indigo-500 outline-none bg-gray-50/50 transition-all font-semibold text-sm" rows={4} />
                  </div>
                </div>
              )}

              {activeTab === 'materials' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <Input label="Nome do Material" name="name" defaultValue={editingItem?.name} required />
                  <div className="flex gap-4">
                    <Input label="Preço Un. (R$)" name="unitPrice" type="number" step="0.01" defaultValue={editingItem?.unitPrice} required />
                    <Input label="Unidade" name="unit" defaultValue={editingItem?.unit} required />
                  </div>
                  <Input label="Estoque Inicial" name="stock" type="number" defaultValue={editingItem?.stock} required />
                </div>
              )}

              {activeTab === 'budgets' && (
                <div className="space-y-12">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="flex flex-col gap-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Selecione o Cliente</label>
                      <select name="clientId" defaultValue={editingItem?.clientId} className="border-2 border-gray-100 rounded-2xl p-4 bg-gray-50/50 outline-none focus:ring-4 focus:ring-indigo-50 focus:border-indigo-500 transition-all font-bold text-sm cursor-pointer" required>
                        <option value="">Buscar cliente...</option>
                        {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                    <Input label="Título Curto / Referência" name="description" defaultValue={editingItem?.description} />
                  </div>

                  <div className="space-y-10">
                    <div className="space-y-6">
                      <div className="flex justify-between items-center border-b-2 border-indigo-100 pb-3">
                        <h4 className="font-black text-indigo-950 text-base tracking-tight flex items-center gap-2">
                          <span className="w-1.5 h-4 bg-indigo-500 rounded-full"></span>
                          ITENS DE SERVIÇO
                        </h4>
                        <button type="button" onClick={() => addBudgetItem('services')} className="text-[10px] bg-indigo-600 text-white px-4 py-2 rounded-full font-black hover:bg-indigo-700 transition shadow-lg shadow-indigo-100">+ ADICIONAR ITEM</button>
                      </div>
                      <div className="space-y-3">
                        {tempBudgetItems.services.map((item, index) => (
                          <div key={index} className="grid grid-cols-12 gap-4 items-center bg-gray-50/50 p-4 rounded-2xl border-2 border-gray-100 group hover:border-indigo-100 transition-colors">
                            <div className="col-span-6 space-y-1">
                              <label className="text-[8px] font-black text-gray-400 uppercase px-1">Serviço</label>
                              <select value={item.id} onChange={(e) => updateBudgetItem('services', index, 'id', e.target.value)} className="w-full border-2 border-transparent rounded-xl p-2.5 text-xs font-bold outline-none bg-white shadow-sm focus:border-indigo-200">
                                <option value="">Escolher...</option>
                                {services.map(s => <option key={s.id} value={s.id}>{s.name} ({s.unit})</option>)}
                              </select>
                            </div>
                            <div className="col-span-2 space-y-1">
                              <label className="text-[8px] font-black text-gray-400 uppercase px-1">Qtd</label>
                              <input type="number" value={item.quantity} onChange={(e) => updateBudgetItem('services', index, 'quantity', Number(e.target.value))} className="w-full border-2 border-transparent rounded-xl p-2.5 text-xs font-bold outline-none bg-white shadow-sm focus:border-indigo-200" />
                            </div>
                            <div className="col-span-3 space-y-1">
                              <label className="text-[8px] font-black text-gray-400 uppercase px-1">Preço Un.</label>
                              <input type="number" value={item.unitPrice} onChange={(e) => updateBudgetItem('services', index, 'unitPrice', Number(e.target.value))} className="w-full border-2 border-transparent rounded-xl p-2.5 text-xs font-bold outline-none bg-white shadow-sm focus:border-indigo-200" />
                            </div>
                            <div className="col-span-1 pt-4 text-center">
                              <button type="button" onClick={() => removeBudgetItem('services', index)} className="text-gray-300 font-bold hover:text-rose-500 transition-colors text-lg">&times;</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div className="flex justify-between items-center border-b-2 border-emerald-100 pb-3">
                        <h4 className="font-black text-indigo-950 text-base tracking-tight flex items-center gap-2">
                          <span className="w-1.5 h-4 bg-emerald-500 rounded-full"></span>
                          MATERIAIS NECESSÁRIOS
                        </h4>
                        <button type="button" onClick={() => addBudgetItem('materials')} className="text-[10px] bg-emerald-600 text-white px-4 py-2 rounded-full font-black hover:bg-emerald-700 transition shadow-lg shadow-emerald-100">+ ADICIONAR ITEM</button>
                      </div>
                      <div className="space-y-3">
                        {tempBudgetItems.materials.map((item, index) => (
                          <div key={index} className="grid grid-cols-12 gap-4 items-center bg-gray-50/50 p-4 rounded-2xl border-2 border-gray-100 group hover:border-emerald-100 transition-colors">
                            <div className="col-span-6 space-y-1">
                              <label className="text-[8px] font-black text-gray-400 uppercase px-1">Material</label>
                              <select value={item.id} onChange={(e) => updateBudgetItem('materials', index, 'id', e.target.value)} className="w-full border-2 border-transparent rounded-xl p-2.5 text-xs font-bold outline-none bg-white shadow-sm focus:border-emerald-200">
                                <option value="">Escolher...</option>
                                {materials.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                              </select>
                            </div>
                            <div className="col-span-2 space-y-1">
                              <label className="text-[8px] font-black text-gray-400 uppercase px-1">Qtd</label>
                              <input type="number" value={item.quantity} onChange={(e) => updateBudgetItem('materials', index, 'quantity', Number(e.target.value))} className="w-full border-2 border-transparent rounded-xl p-2.5 text-xs font-bold outline-none bg-white shadow-sm focus:border-emerald-200" />
                            </div>
                            <div className="col-span-3 space-y-1">
                              <label className="text-[8px] font-black text-gray-400 uppercase px-1">Preço Un.</label>
                              <input type="number" value={item.unitPrice} onChange={(e) => updateBudgetItem('materials', index, 'unitPrice', Number(e.target.value))} className="w-full border-2 border-transparent rounded-xl p-2.5 text-xs font-bold outline-none bg-white shadow-sm focus:border-emerald-200" />
                            </div>
                            <div className="col-span-1 pt-4 text-center">
                              <button type="button" onClick={() => removeBudgetItem('materials', index)} className="text-gray-300 font-bold hover:text-rose-500 transition-colors text-lg">&times;</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="pt-10 border-t-4 border-indigo-50 flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="flex flex-col">
                      <span className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] mb-1">Total Consolidado</span>
                      <div className="text-5xl font-black text-indigo-700 tracking-tight">R$ {currentTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                    </div>
                    <div className="flex gap-4 w-full md:w-auto">
                      <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 md:px-12 py-5 border-2 border-gray-100 rounded-2xl text-gray-400 hover:bg-gray-50 font-black transition text-sm uppercase tracking-widest">DESCARTAR</button>
                      <button type="submit" className="flex-1 md:px-12 py-5 bg-indigo-600 text-white rounded-2xl hover:bg-indigo-700 font-black transition shadow-2xl shadow-indigo-200 text-sm uppercase tracking-widest">SALVAR DADOS</button>
                    </div>
                  </div>
                </div>
              )}

              {activeTab !== 'budgets' && (
                <div className="flex gap-4 pt-10 border-t border-gray-50">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 px-8 py-5 border-2 border-gray-100 rounded-2xl text-gray-400 hover:bg-gray-50 font-black transition text-sm uppercase tracking-widest">CANCELAR</button>
                  <button type="submit" className="flex-1 px-8 py-5 bg-indigo-600 text-white rounded-2xl hover:bg-indigo-700 font-black transition shadow-2xl shadow-indigo-200 text-sm uppercase tracking-widest">CONFIRMAR E SALVAR</button>
                </div>
              )}
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
};

const Input: React.FC<{ label: string; name: string; type?: string; defaultValue?: any; required?: boolean; step?: string }> = ({ label, name, type = "text", defaultValue, required, step }) => (
  <div className="flex flex-col gap-2 w-full">
    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">{label}</label>
    <input 
      type={type} 
      name={name} 
      defaultValue={defaultValue} 
      required={required} 
      step={step} 
      className="border-2 border-gray-100 rounded-2xl p-4 focus:ring-4 focus:ring-indigo-50 focus:border-indigo-500 outline-none bg-gray-50/50 text-sm font-bold transition-all" 
    />
  </div>
);

const ManagementList: React.FC<{ title: string; items: any[]; onAdd: () => void; onEdit: (item: any) => void }> = ({ title, items, onAdd, onEdit }) => (
  <div className="space-y-6">
    <div className="flex justify-between items-center">
      <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest">Listagem de {title}</h2>
      <button onClick={onAdd} className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-black transition text-xs shadow-lg shadow-indigo-100 flex items-center gap-2">
        <span className="text-lg">+</span> NOVO {title.toUpperCase().slice(0, -1)}
      </button>
    </div>
    <div className="bg-white rounded-[2rem] shadow-sm border border-gray-100 overflow-hidden">
      <table className="w-full text-left border-collapse">
        <thead className="bg-gray-50/50 border-b border-gray-100">
          <tr><th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Descrição Item</th><th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Investimento / Unid</th><th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Ações</th></tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {items.map(item => (
            <tr key={item.id} className="hover:bg-indigo-50/20 transition group">
              <td className="px-8 py-6">
                <div className="font-bold text-gray-800 text-base">{item.name}</div>
                <div className="text-xs text-gray-400 mt-1 line-clamp-1 max-w-sm">{item.description || `Referência ID: ${item.id}`}</div>
              </td>
              <td className="px-8 py-6">
                <div className="text-base text-indigo-700 font-black">R$ {(item.basePrice || item.unitPrice).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                <div className="text-[10px] font-black text-gray-400 uppercase">Cobrança por {item.unit}</div>
              </td>
              <td className="px-8 py-6 text-right">
                <button onClick={() => onEdit(item)} className="text-indigo-600 hover:bg-indigo-600 hover:text-white font-black text-[10px] tracking-widest px-5 py-2 rounded-xl border border-indigo-100 transition-all uppercase">EDITAR</button>
              </td>
            </tr>
          ))}
          {items.length === 0 && <tr><td colSpan={3} className="px-8 py-20 text-center">
            <div className="text-gray-300 font-black uppercase tracking-widest text-xs italic">Nenhum registro ativo no sistema.</div>
          </td></tr>}
        </tbody>
      </table>
    </div>
  </div>
);

export default App;