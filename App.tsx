
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

const STORAGE_KEYS = {
  CLIENTS: 'mixto_v1_clients',
  SERVICES: 'mixto_v1_services',
  MATERIALS: 'mixto_v1_materials',
  BUDGETS: 'mixto_v1_budgets'
};

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  
  const [clients, setClients] = useState<Client[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.CLIENTS);
    return saved ? JSON.parse(saved) : [
      { id: 'c1', name: 'Cliente Demonstração', email: 'contato@mixto.com', phone: '92988091790', address: 'Av. Principal, 100', document: '000.000.000-00' }
    ];
  });

  const [services, setServices] = useState<ServiceType[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.SERVICES);
    return saved ? JSON.parse(saved) : [
      { id: 's1', name: 'Reforma Geral', description: 'Serviços de alvenaria e acabamento', basePrice: 2500, unit: 'global' }
    ];
  });

  const [materials, setMaterials] = useState<Material[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.MATERIALS);
    return saved ? JSON.parse(saved) : [
      { id: 'm1', name: 'Cimento CP-II', unitPrice: 45, stock: 50, unit: 'saco' }
    ];
  });

  const [budgets, setBudgets] = useState<Budget[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.BUDGETS);
    return saved ? JSON.parse(saved) : [];
  });

  const [expandedBudgetId, setExpandedBudgetId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [tempBudgetItems, setTempBudgetItems] = useState<{
    services: BudgetItem[];
    materials: BudgetItem[];
  }>({ services: [], materials: [] });

  useEffect(() => localStorage.setItem(STORAGE_KEYS.CLIENTS, JSON.stringify(clients)), [clients]);
  useEffect(() => localStorage.setItem(STORAGE_KEYS.SERVICES, JSON.stringify(services)), [services]);
  useEffect(() => localStorage.setItem(STORAGE_KEYS.MATERIALS, JSON.stringify(materials)), [materials]);
  useEffect(() => localStorage.setItem(STORAGE_KEYS.BUDGETS, JSON.stringify(budgets)), [budgets]);

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
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const data = months.map(m => ({ name: m, value: 0 }));
    budgets.forEach(b => {
      const date = new Date(b.date);
      if (!isNaN(date.getTime())) {
        const monthIdx = date.getMonth();
        data[monthIdx].value += b.totalValue;
      }
    });
    return data;
  }, [budgets]);

  const handleAddOrEdit = (type: string, data: any) => {
    const finalId = editingItem ? editingItem.id : Math.random().toString(36).substr(2, 9);
    let finalData = { ...data, id: finalId };
    
    if (type === 'budgets') {
      finalData.services = tempBudgetItems.services;
      finalData.materials = tempBudgetItems.materials;
      finalData.tasks = editingItem?.tasks || [];
      finalData.totalValue = calculateTotal(tempBudgetItems.services, tempBudgetItems.materials);
      if (!editingItem) finalData.id = `${(budgets.length + 1).toString().padStart(3, '0')}/${new Date().getFullYear()}`;
    }

    if (type === 'clients') setClients(prev => editingItem ? prev.map(c => c.id === finalId ? finalData : c) : [...prev, finalData]);
    else if (type === 'services') setServices(prev => editingItem ? prev.map(s => s.id === finalId ? finalData : s) : [...prev, finalData]);
    else if (type === 'materials') setMaterials(prev => editingItem ? prev.map(m => m.id === finalId ? finalData : m) : [...prev, finalData]);
    else if (type === 'budgets') setBudgets(prev => editingItem ? prev.map(b => b.id === finalId ? finalData : b) : [...prev, finalData]);

    setIsModalOpen(false);
    setEditingItem(null);
  };

  const calculateTotal = (srvs: BudgetItem[], mats: BudgetItem[]) => {
    const srvTotal = srvs.reduce((acc, item) => acc + (item.unitPrice * item.quantity), 0);
    const matTotal = mats.reduce((acc, item) => acc + (item.unitPrice * item.quantity), 0);
    return srvTotal + matTotal;
  };

  const currentTotal = useMemo(() => calculateTotal(tempBudgetItems.services, tempBudgetItems.materials), [tempBudgetItems]);

  const updateTaskStatus = (budgetId: string, taskId: string, newStatus: TaskStatus) => {
    setBudgets(prev => prev.map(b => b.id === budgetId ? { ...b, tasks: b.tasks.map(t => t.id === taskId ? { ...t, status: newStatus } : t) } : b));
  };

  const addTaskToBudget = (budgetId: string, stage: 'Planejamento' | 'Execução', description: string) => {
    if (!description.trim()) return;
    const newTask: ProjectTask = { id: Math.random().toString(36).substr(2, 9), description, stage, status: TaskStatus.PENDING };
    setBudgets(prev => prev.map(b => b.id === budgetId ? { ...b, tasks: [...b.tasks, newTask] } : b));
  };

  const addBudgetItem = (type: 'services' | 'materials') => {
    setTempBudgetItems(prev => ({ ...prev, [type]: [...prev[type], { id: '', quantity: 1, unitPrice: 0 }] }));
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

  return (
    <Layout activeTab={activeTab} setActiveTab={setActiveTab}>
      <div className="fade-in">
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { label: 'Clientes', value: stats.totalClients },
                { label: 'Orçamentos', value: stats.totalBudgets },
                { label: 'Receita Bruta', value: `R$ ${stats.totalRevenue.toLocaleString()}` },
                { label: 'Serviços em Aberto', value: stats.activeServices },
              ].map((stat, i) => (
                <div key={i} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col hover:border-indigo-300 transition-colors">
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{stat.label}</span>
                  <span className="text-2xl font-black text-indigo-950 mt-2">{stat.value}</span>
                </div>
              ))}
            </div>
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
              <h3 className="text-sm font-black text-gray-800 mb-8 flex items-center gap-2 uppercase tracking-widest">
                <span className="w-1.5 h-4 bg-indigo-600 rounded-full"></span>
                Fluxo Financeiro Mensal
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
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10}} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10}} tickFormatter={(v) => `R$${v}`} />
                    <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                    <Area type="monotone" dataKey="value" stroke="#4f46e5" strokeWidth={4} fillOpacity={1} fill="url(#colorValue)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'clients' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Gestão de Clientes</h2>
              <button onClick={() => { setEditingItem(null); setIsModalOpen(true); }} className="bg-indigo-600 text-white px-6 py-3 rounded-2xl font-black text-[10px] tracking-widest hover:bg-indigo-700 shadow-xl shadow-indigo-100 transition-all uppercase">+ Novo Cliente</button>
            </div>
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-gray-50/50 border-b border-gray-100">
                  <tr><th className="px-8 py-5 text-[9px] font-black text-gray-400 uppercase tracking-[0.2em]">Identificação</th><th className="px-8 py-5 text-[9px] font-black text-gray-400 uppercase tracking-[0.2em]">Contato</th><th className="px-8 py-5 text-right"></th></tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {clients.map(c => (
                    <tr key={c.id} className="hover:bg-indigo-50/20 transition group">
                      <td className="px-8 py-6">
                        <div className="font-bold text-gray-900 group-hover:text-indigo-600 transition-colors">{c.name}</div>
                        <div className="text-[10px] font-mono text-gray-400 mt-0.5">{c.document}</div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="text-sm font-semibold text-gray-600">{c.phone}</div>
                        <div className="text-[10px] text-gray-400 truncate max-w-xs">{c.email}</div>
                      </td>
                      <td className="px-8 py-6 text-right">
                        <button onClick={() => { setEditingItem(c); setIsModalOpen(true); }} className="text-[10px] font-black text-indigo-600 hover:text-indigo-900 tracking-widest uppercase">Editar</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'budgets' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Controle de Orçamentos</h2>
              <button onClick={() => { setEditingItem(null); setIsModalOpen(true); }} className="bg-indigo-600 text-white px-6 py-3 rounded-2xl font-black text-[10px] tracking-widest hover:bg-indigo-700 shadow-xl shadow-indigo-100 transition-all uppercase">+ Criar Orçamento</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {budgets.map(b => {
                const client = clients.find(c => c.id === b.clientId);
                return (
                  <div key={b.id} className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm hover:shadow-xl hover:scale-[1.02] transition-all duration-300">
                    <div className="flex justify-between items-start mb-6">
                      <div className="max-w-[70%]">
                        <h4 className="font-black text-gray-950 truncate leading-tight uppercase text-sm">{client?.name || 'Cliente'}</h4>
                        <div className="text-[9px] text-indigo-500 font-black tracking-widest mt-1 uppercase">Ref. {b.id}</div>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest ${
                        b.status === ServiceStatus.COMPLETED ? 'bg-emerald-500 text-white' : 
                        b.status === ServiceStatus.APPROVED ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-500'
                      }`}>{b.status}</span>
                    </div>
                    <div className="bg-indigo-50/50 p-5 rounded-2xl mb-6">
                      <div className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-1">Valor do Orçamento</div>
                      <div className="text-3xl font-black text-indigo-700 tracking-tighter">R$ {b.totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button onClick={() => openWhatsApp(client?.phone || '', generateBudgetSummaryText(b, client, services, materials))} className="bg-emerald-50 text-emerald-700 py-3 rounded-xl text-[9px] font-black hover:bg-emerald-100 transition uppercase tracking-widest">WhatsApp</button>
                      <button onClick={() => generateBudgetPDF(b, client, services, materials)} className="bg-indigo-50 text-indigo-700 py-3 rounded-xl text-[9px] font-black hover:bg-indigo-100 transition uppercase tracking-widest">PDF</button>
                      <button onClick={() => { setEditingItem(b); setIsModalOpen(true); }} className="col-span-2 py-3 text-[9px] font-black text-gray-400 hover:text-indigo-600 transition uppercase tracking-[0.2em] text-center border-t border-gray-50 mt-2">Editar Detalhes</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === 'tracking' && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {[ServiceStatus.PENDING, ServiceStatus.APPROVED, ServiceStatus.IN_PROGRESS, ServiceStatus.COMPLETED].map(status => (
              <div key={status} className="bg-gray-50/50 p-4 rounded-3xl min-h-[600px] border border-gray-200/50">
                <div className="flex items-center justify-between mb-6 px-1">
                  <h3 className="font-black text-gray-800 text-[9px] uppercase tracking-[0.2em] flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${status === ServiceStatus.COMPLETED ? 'bg-emerald-500' : 'bg-indigo-500'}`}></span>
                    {status}
                  </h3>
                  <span className="text-[9px] font-bold text-gray-400 bg-white px-2 py-1 rounded-full border border-gray-100">{budgets.filter(b => b.status === status).length}</span>
                </div>
                <div className="space-y-4">
                  {budgets.filter(b => b.status === status).map(budget => {
                    const isExpanded = expandedBudgetId === budget.id;
                    const completedTasks = budget.tasks.filter(t => t.status === TaskStatus.COMPLETED).length;
                    const progress = budget.tasks.length > 0 ? (completedTasks / budget.tasks.length) * 100 : 0;
                    return (
                      <div key={budget.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:border-indigo-200 transition-all">
                        <div className="p-5">
                          <p className="font-black text-gray-900 text-[11px] leading-tight mb-1 uppercase tracking-tight">{clients.find(c => c.id === budget.clientId)?.name}</p>
                          <div className="text-[8px] text-indigo-500 font-black mb-4 uppercase tracking-[0.2em]">Cód. {budget.id}</div>
                          <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden mb-4">
                            <div className={`h-full transition-all duration-700 ${progress === 100 ? 'bg-emerald-500' : 'bg-indigo-600'}`} style={{ width: `${progress}%` }} />
                          </div>
                          <select value={budget.status} onChange={(e) => setBudgets(prev => prev.map(b => b.id === budget.id ? { ...b, status: e.target.value as ServiceStatus } : b))} className="w-full text-[9px] border border-gray-100 rounded-xl p-2 bg-gray-50 font-black outline-none cursor-pointer mb-3">
                            <option value={ServiceStatus.PENDING}>Pendente</option>
                            <option value={ServiceStatus.APPROVED}>Aprovado</option>
                            <option value={ServiceStatus.IN_PROGRESS}>Em Andamento</option>
                            <option value={ServiceStatus.COMPLETED}>Concluído</option>
                          </select>
                          <button onClick={() => setExpandedBudgetId(isExpanded ? null : budget.id)} className="w-full py-2 bg-indigo-50 text-indigo-600 rounded-xl text-[8px] font-black uppercase tracking-widest hover:bg-indigo-100 transition-all">
                            {isExpanded ? 'Fechar' : 'Gerenciar Etapas'}
                          </button>
                        </div>
                        {isExpanded && (
                          <div className="bg-indigo-50/20 border-t border-indigo-50 p-5 space-y-6">
                            {['Planejamento', 'Execução'].map(stage => (
                              <div key={stage} className="space-y-3">
                                <h4 className="text-[8px] font-black text-indigo-400 uppercase tracking-widest border-b border-indigo-50 pb-1">{stage}</h4>
                                <div className="space-y-2">
                                  {budget.tasks.filter(t => t.stage === stage).map(task => (
                                    <div key={task.id} className="bg-white p-3 rounded-xl border border-indigo-50 shadow-sm flex flex-col gap-2">
                                      <p className="text-[10px] text-gray-700 font-bold leading-none">{task.description}</p>
                                      <div className="flex gap-1">
                                        <button onClick={() => updateTaskStatus(budget.id, task.id, TaskStatus.COMPLETED)} className={`flex-1 py-1.5 rounded-lg text-[7px] font-black transition-all ${task.status === TaskStatus.COMPLETED ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-400 hover:bg-emerald-50'}`}>OK</button>
                                        <button onClick={() => updateTaskStatus(budget.id, task.id, TaskStatus.DELAYED)} className={`flex-1 py-1.5 rounded-lg text-[7px] font-black transition-all ${task.status === TaskStatus.DELAYED ? 'bg-rose-500 text-white' : 'bg-gray-100 text-gray-400 hover:bg-rose-50'}`}>ATRASO</button>
                                      </div>
                                    </div>
                                  ))}
                                  <div className="flex gap-1 pt-2">
                                    <input type="text" placeholder="Nova etapa..." className="flex-1 text-[9px] p-2 rounded-lg border-none bg-white shadow-sm font-semibold outline-none focus:ring-1 focus:ring-indigo-200" onKeyDown={(e) => { if (e.key === 'Enter') { addTaskToBudget(budget.id, stage as any, e.currentTarget.value); e.currentTarget.value = ''; } }} />
                                    <button onClick={(e) => { const input = e.currentTarget.previousElementSibling as HTMLInputElement; addTaskToBudget(budget.id, stage as any, input.value); input.value = ''; }} className="bg-indigo-600 text-white w-8 h-8 rounded-lg font-black">+</button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {isModalOpen && (
          <div className="fixed inset-0 bg-indigo-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-[2.5rem] w-full max-w-4xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh] animate-in zoom-in-95">
              <div className="p-8 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                <h3 className="text-lg font-black text-indigo-950 tracking-tight flex items-center gap-3 uppercase">
                  <span className="w-1.5 h-6 bg-indigo-600 rounded-full"></span>
                  {editingItem ? 'Editar' : 'Novo'} {activeTab.slice(0, -1)}
                </h3>
                <button onClick={() => setIsModalOpen(false)} className="w-10 h-10 rounded-full bg-white text-gray-400 hover:text-rose-500 transition-all text-2xl font-light">&times;</button>
              </div>
              <form onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const data: any = {};
                formData.forEach((v, k) => data[k] = ['basePrice', 'unitPrice', 'stock'].includes(k) ? Number(v) : v);
                if (activeTab === 'budgets') { data.date = editingItem?.date || new Date().toISOString(); data.status = editingItem?.status || ServiceStatus.PENDING; }
                handleAddOrEdit(activeTab, data);
              }} className="flex-1 overflow-y-auto p-8 lg:p-12 space-y-8">
                {activeTab === 'clients' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Input label="Nome Completo" name="name" defaultValue={editingItem?.name} required />
                    <Input label="CPF ou CNPJ" name="document" defaultValue={editingItem?.document} />
                    <Input label="E-mail" name="email" type="email" defaultValue={editingItem?.email} />
                    <Input label="Telefone" name="phone" defaultValue={editingItem?.phone} required />
                    <div className="md:col-span-2"><Input label="Endereço Completo" name="address" defaultValue={editingItem?.address} /></div>
                  </div>
                )}
                {activeTab === 'budgets' && (
                  <div className="space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="flex flex-col gap-2">
                        <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest px-1">Cliente</label>
                        <select name="clientId" defaultValue={editingItem?.clientId} className="border-2 border-gray-100 rounded-2xl p-4 bg-gray-50 font-bold text-sm outline-none focus:border-indigo-500" required>
                          <option value="">Buscar...</option>
                          {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      </div>
                      <Input label="Referência / Projeto" name="description" defaultValue={editingItem?.description} />
                    </div>
                    <div className="space-y-6">
                      <div className="flex justify-between items-center border-b border-gray-100 pb-2"><h4 className="text-[10px] font-black text-indigo-900 tracking-widest uppercase">Serviços</h4><button type="button" onClick={() => addBudgetItem('services')} className="text-[8px] bg-indigo-600 text-white px-3 py-1.5 rounded-full font-black uppercase">Adicionar</button></div>
                      <div className="space-y-2">{tempBudgetItems.services.map((item, index) => (
                        <div key={index} className="grid grid-cols-12 gap-3 items-center bg-gray-50 p-4 rounded-2xl border border-gray-100">
                          <select value={item.id} onChange={(e) => updateBudgetItem('services', index, 'id', e.target.value)} className="col-span-6 border rounded-xl p-2.5 text-xs font-bold bg-white">
                            <option value="">Serviço...</option>{services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                          </select>
                          <input type="number" value={item.quantity} onChange={(e) => updateBudgetItem('services', index, 'quantity', Number(e.target.value))} className="col-span-2 border rounded-xl p-2.5 text-xs font-bold" placeholder="Qtd" />
                          <input type="number" value={item.unitPrice} onChange={(e) => updateBudgetItem('services', index, 'unitPrice', Number(e.target.value))} className="col-span-3 border rounded-xl p-2.5 text-xs font-bold" placeholder="Preço" />
                          <button type="button" onClick={() => setTempBudgetItems(p => ({ ...p, services: p.services.filter((_, i) => i !== index) }))} className="col-span-1 text-rose-500 font-bold text-xl">&times;</button>
                        </div>
                      ))}</div>
                    </div>
                  </div>
                )}
                <div className="flex gap-4 pt-10 border-t border-gray-50">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-5 border-2 border-gray-100 rounded-2xl text-gray-400 font-black text-[10px] tracking-widest uppercase">Descartar</button>
                  <button type="submit" className="flex-1 py-5 bg-indigo-600 text-white rounded-2xl font-black text-[10px] tracking-widest hover:bg-indigo-700 shadow-2xl shadow-indigo-100 transition-all uppercase">Salvar Dados</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

const Input: React.FC<{ label: string; name: string; type?: string; defaultValue?: any; required?: boolean }> = ({ label, name, type = "text", defaultValue, required }) => (
  <div className="flex flex-col gap-2 w-full">
    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest px-1">{label}</label>
    <input type={type} name={name} defaultValue={defaultValue} required={required} className="border-2 border-gray-100 rounded-2xl p-4 focus:border-indigo-500 outline-none bg-gray-50 text-sm font-bold transition-all" />
  </div>
);

export default App;
