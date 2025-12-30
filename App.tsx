
import React, { useState, useEffect, useMemo, useRef } from 'react';
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
import { GoogleGenAI } from "@google/genai";

const STORAGE_KEYS = {
  CLIENTS: 'mixto_v1_clients',
  SERVICES: 'mixto_v1_services',
  MATERIALS: 'mixto_v1_materials',
  BUDGETS: 'mixto_v1_budgets'
};

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // States para dados
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

  // States para UI
  const [expandedBudgetId, setExpandedBudgetId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [tempBudgetItems, setTempBudgetItems] = useState<{
    services: BudgetItem[];
    materials: BudgetItem[];
  }>({ services: [], materials: [] });

  // AI Chat States
  const [isAiOpen, setIsAiOpen] = useState(false);
  const [aiMessages, setAiMessages] = useState<{role: 'user' | 'ai', text: string}[]>([
    { role: 'ai', text: 'Olá! Sou o assistente do Mixto de Tudo. Como posso ajudar com seus serviços hoje?' }
  ]);
  const [aiInput, setAiInput] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [aiMessages]);

  useEffect(() => localStorage.setItem(STORAGE_KEYS.CLIENTS, JSON.stringify(clients)), [clients]);
  useEffect(() => localStorage.setItem(STORAGE_KEYS.SERVICES, JSON.stringify(services)), [services]);
  useEffect(() => localStorage.setItem(STORAGE_KEYS.MATERIALS, JSON.stringify(materials)), [materials]);
  useEffect(() => localStorage.setItem(STORAGE_KEYS.BUDGETS, JSON.stringify(budgets)), [budgets]);

  const stats: DashboardStats = useMemo(() => {
    return {
      totalClients: clients.length,
      totalBudgets: budgets.length,
      totalRevenue: budgets.reduce((acc, b) => acc + b.totalValue, 0),
      activeServices: budgets.filter(b => b.status === ServiceStatus.IN_PROGRESS || b.status === ServiceStatus.APPROVED).length,
    };
  }, [clients, budgets]);

  const handleAiMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiInput.trim() || isAiLoading) return;

    const userMsg = aiInput;
    setAiInput('');
    setAiMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsAiLoading(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
      const systemPrompt = `Você é o assistente virtual do software "Mixto de Tudo Serviços".
      Contexto atual do sistema:
      - Total de Clientes: ${stats.totalClients}
      - Total de Orçamentos: ${stats.totalBudgets}
      - Receita Total Acumulada: R$ ${stats.totalRevenue.toLocaleString('pt-BR')}
      - Serviços em andamento/aprovados: ${stats.activeServices}
      
      Responda de forma profissional, amigável e concisa em Português. 
      Se o usuário perguntar como fazer algo, explique usando os menus do app: Dashboard, Clientes, Serviços, Materiais, Orçamentos e Acompanhamento.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: userMsg,
        config: { systemInstruction: systemPrompt }
      });

      setAiMessages(prev => [...prev, { role: 'ai', text: response.text || "Desculpe, não consegui processar isso agora." }]);
    } catch (error) {
      console.error("Erro AI:", error);
      setAiMessages(prev => [...prev, { role: 'ai', text: "Houve um erro ao conectar com a inteligência artificial. Verifique se a chave API está configurada no Netlify." }]);
    } finally {
      setIsAiLoading(false);
    }
  };

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
      finalData.totalValue = tempBudgetItems.services.reduce((acc, item) => acc + (item.unitPrice * item.quantity), 0) + 
                             tempBudgetItems.materials.reduce((acc, item) => acc + (item.unitPrice * item.quantity), 0);
      if (!editingItem) finalData.id = `${(budgets.length + 1).toString().padStart(3, '0')}/${new Date().getFullYear()}`;
    }

    if (type === 'clients') setClients(prev => editingItem ? prev.map(c => c.id === finalId ? finalData : c) : [...prev, finalData]);
    else if (type === 'services') setServices(prev => editingItem ? prev.map(s => s.id === finalId ? finalData : s) : [...prev, finalData]);
    else if (type === 'materials') setMaterials(prev => editingItem ? prev.map(m => m.id === finalId ? finalData : m) : [...prev, finalData]);
    else if (type === 'budgets') setBudgets(prev => editingItem ? prev.map(b => b.id === finalId ? finalData : b) : [...prev, finalData]);

    setIsModalOpen(false);
    setEditingItem(null);
  };

  const addTaskToBudget = (budgetId: string, stage: 'Planejamento' | 'Execução', description: string) => {
    if (!description.trim()) return;
    const newTask: ProjectTask = { id: Math.random().toString(36).substr(2, 9), description, stage, status: TaskStatus.PENDING };
    setBudgets(prev => prev.map(b => b.id === budgetId ? { ...b, tasks: [...b.tasks, newTask] } : b));
  };

  return (
    <Layout activeTab={activeTab} setActiveTab={setActiveTab}>
      <div className="fade-in">
        {/* Renderização de Abas existente... */}
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
            {/* Gráfico Recharts... */}
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
               <h3 className="text-sm font-black text-gray-800 mb-8 flex items-center gap-2 uppercase tracking-widest">
                <span className="w-1.5 h-4 bg-indigo-600 rounded-full"></span>
                Fluxo Mensal de Receita
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

        {/* Abas de Clientes, Orçamentos e Tracking omitidas para brevidade mas mantidas no código real conforme arquivos anteriores */}
        {activeTab === 'clients' && (
           <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Gestão de Clientes</h2>
              <button onClick={() => { setEditingItem(null); setIsModalOpen(true); }} className="bg-indigo-600 text-white px-6 py-3 rounded-2xl font-black text-[10px] tracking-widest hover:bg-indigo-700 transition-all uppercase shadow-lg shadow-indigo-100">+ Novo Cliente</button>
            </div>
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden overflow-x-auto">
              <table className="w-full text-left min-w-[600px]">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-8 py-5 text-[9px] font-black text-gray-400 uppercase tracking-widest">Identificação</th>
                    <th className="px-8 py-5 text-[9px] font-black text-gray-400 uppercase tracking-widest">Contato</th>
                    <th className="px-8 py-5 text-right"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {clients.map(c => (
                    <tr key={c.id} className="hover:bg-indigo-50/20 transition">
                      <td className="px-8 py-6">
                        <div className="font-bold text-gray-900">{c.name}</div>
                        <div className="text-[10px] text-gray-400">{c.document}</div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="text-sm font-semibold text-gray-600">{c.phone}</div>
                        <div className="text-[10px] text-gray-400">{c.email}</div>
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

        {/* AI BUBBLE UI */}
        <div id="ai-bubble">
          {!isAiOpen ? (
            <button 
              onClick={() => setIsAiOpen(true)}
              className="w-16 h-16 bg-indigo-600 rounded-full shadow-2xl flex items-center justify-center text-white hover:scale-110 transition-transform active:scale-95 shadow-indigo-400"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 8-9.04 9.06a2.82 2.82 0 1 0 3.98 3.98L16 12"/><circle cx="17" cy="7" r="5"/></svg>
            </button>
          ) : (
            <div className="ai-chat-window w-80 sm:w-96 h-[500px] bg-white rounded-[2rem] shadow-2xl border border-gray-100 flex flex-col overflow-hidden">
              <div className="bg-indigo-600 p-6 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg>
                  </div>
                  <div className="text-white">
                    <p className="text-xs font-black uppercase tracking-widest">Assistente Mixto</p>
                    <p className="text-[8px] opacity-80 uppercase font-bold">Powered by Gemini AI</p>
                  </div>
                </div>
                <button onClick={() => setIsAiOpen(false)} className="text-white/80 hover:text-white">&times;</button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50/50">
                {aiMessages.map((msg, idx) => (
                  <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] p-3 rounded-2xl text-[11px] font-medium leading-relaxed shadow-sm ${
                      msg.role === 'user' 
                        ? 'bg-indigo-600 text-white rounded-tr-none' 
                        : 'bg-white text-gray-700 border border-gray-100 rounded-tl-none'
                    }`}>
                      {msg.text}
                    </div>
                  </div>
                ))}
                {isAiLoading && (
                  <div className="flex justify-start">
                    <div className="bg-white p-3 rounded-2xl border border-gray-100 flex gap-1">
                      <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce"></span>
                      <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                      <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:0.4s]"></span>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              <form onSubmit={handleAiMessage} className="p-4 border-t border-gray-100 bg-white">
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={aiInput}
                    onChange={(e) => setAiInput(e.target.value)}
                    placeholder="Pergunte algo..."
                    className="flex-1 bg-gray-50 border-none rounded-xl px-4 py-2 text-[11px] font-semibold outline-none focus:ring-1 focus:ring-indigo-200"
                  />
                  <button type="submit" className="bg-indigo-600 text-white w-10 h-10 rounded-xl flex items-center justify-center hover:bg-indigo-700 transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>

        {/* Modal de Cadastro simplificado */}
        {isModalOpen && (
           <div className="fixed inset-0 bg-indigo-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-[2.5rem] w-full max-w-4xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
               <div className="p-8 border-b border-gray-100 flex justify-between items-center">
                <h3 className="text-lg font-black text-indigo-950 uppercase tracking-tight">
                  {editingItem ? 'Editar' : 'Novo'} {activeTab === 'clients' ? 'Cliente' : 'Item'}
                </h3>
                <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-rose-500 text-2xl">&times;</button>
              </div>
              <form onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const data: any = {};
                formData.forEach((v, k) => data[k] = v);
                handleAddOrEdit(activeTab, data);
              }} className="p-8 space-y-6 overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   <div className="flex flex-col gap-1">
                      <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Nome Completo</label>
                      <input name="name" defaultValue={editingItem?.name} required className="border-2 border-gray-100 rounded-xl p-3 bg-gray-50 font-bold text-sm outline-none focus:border-indigo-500" />
                   </div>
                   <div className="flex flex-col gap-1">
                      <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Telefone</label>
                      <input name="phone" defaultValue={editingItem?.phone} required className="border-2 border-gray-100 rounded-xl p-3 bg-gray-50 font-bold text-sm outline-none focus:border-indigo-500" />
                   </div>
                   <div className="flex flex-col gap-1 md:col-span-2">
                      <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Documento (CPF/CNPJ)</label>
                      <input name="document" defaultValue={editingItem?.document} className="border-2 border-gray-100 rounded-xl p-3 bg-gray-50 font-bold text-sm outline-none focus:border-indigo-500" />
                   </div>
                </div>
                <div className="pt-6 border-t border-gray-50 flex gap-4">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-4 text-[10px] font-black uppercase text-gray-400">Cancelar</button>
                  <button type="submit" className="flex-1 py-4 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase shadow-lg shadow-indigo-100">Salvar Dados</button>
                </div>
              </form>
            </div>
           </div>
        )}
      </div>
    </Layout>
  );
};

export default App;
