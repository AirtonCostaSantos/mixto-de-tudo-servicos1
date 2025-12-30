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
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [tempBudgetItems, setTempBudgetItems] = useState<{
    services: BudgetItem[];
    materials: BudgetItem[];
  }>({ services: [], materials: [] });

  // AI Chat States
  const [isAiOpen, setIsAiOpen] = useState(false);
  const [aiMessages, setAiMessages] = useState<{role: 'user' | 'ai', text: string}[]>([
    { role: 'ai', text: 'Olá! Sou o assistente do Mixto de Tudo. Posso ajudar você com informações sobre seus clientes, orçamentos ou como usar o sistema. Como posso ajudar hoje?' }
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
      
      const systemPrompt = `Você é o assistente virtual exclusivo do software "Mixto de Tudo Serviços".
      Você ajuda o administrador a gerenciar o negócio.
      
      DADOS ATUAIS DO SISTEMA:
      - Total de Clientes cadastrados: ${stats.totalClients}
      - Total de Orçamentos realizados: ${stats.totalBudgets}
      - Receita Bruta Total: R$ ${stats.totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
      - Serviços Ativos (Em andamento ou Aprovados): ${stats.activeServices}
      
      LISTA DE CLIENTES:
      ${clients.map(c => `- ${c.name} (Doc: ${c.document})`).join('\n')}

      INSTRUÇÕES:
      1. Responda de forma profissional, executiva e amigável.
      2. Se perguntarem sobre faturamento, cite o valor da Receita Bruta Total.
      3. Se perguntarem sobre clientes, você pode citar nomes da lista.
      4. Se o usuário quiser saber como cadastrar algo, direcione para as abas no menu lateral.
      5. Mantenha as respostas curtas e objetivas.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: userMsg,
        config: { systemInstruction: systemPrompt }
      });

      setAiMessages(prev => [...prev, { role: 'ai', text: response.text || "Não consegui processar sua solicitação agora." }]);
    } catch (error) {
      console.error("Erro na API Gemini:", error);
      setAiMessages(prev => [...prev, { role: 'ai', text: "Erro ao conectar com a inteligência artificial. Verifique se a chave API_KEY está configurada corretamente no seu painel do Netlify." }]);
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

  return (
    <Layout activeTab={activeTab} setActiveTab={setActiveTab}>
      <div className="fade-in">
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { label: 'Clientes', value: stats.totalClients },
                { label: 'Orçamentos', value: stats.totalBudgets },
                { label: 'Receita Bruta', value: `R$ ${stats.totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` },
                { label: 'Serviços Ativos', value: stats.activeServices },
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

        {/* AI BUBBLE UI */}
        <div id="ai-bubble">
          {!isAiOpen ? (
            <button 
              onClick={() => setIsAiOpen(true)}
              className="w-16 h-16 bg-indigo-600 rounded-full shadow-2xl flex items-center justify-center text-white hover:scale-110 transition-transform active:scale-95 shadow-indigo-400/50"
              title="Assistente IA"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 8-9.04 9.06a2.82 2.82 0 1 0 3.98 3.98L16 12"/><circle cx="17" cy="7" r="5"/></svg>
            </button>
          ) : (
            <div className="ai-chat-window w-80 sm:w-96 h-[550px] bg-white rounded-[2rem] shadow-2xl border border-gray-100 flex flex-col overflow-hidden">
              <div className="bg-indigo-600 p-6 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg>
                  </div>
                  <div className="text-white">
                    <p className="text-[10px] font-black uppercase tracking-widest leading-none">Assistente Mixto</p>
                    <p className="text-[8px] opacity-70 uppercase font-bold mt-1">Conectado via Gemini</p>
                  </div>
                </div>
                <button onClick={() => setIsAiOpen(false)} className="text-white/80 hover:text-white bg-white/10 w-8 h-8 rounded-lg flex items-center justify-center transition-colors">
                   <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50/30">
                {aiMessages.map((msg, idx) => (
                  <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] p-4 rounded-2xl text-[12px] font-medium leading-relaxed shadow-sm ${
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
                    <div className="bg-white p-4 rounded-2xl border border-gray-100 flex gap-1.5 items-center">
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
                    placeholder="Como posso ajudar?"
                    className="flex-1 bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-[12px] font-semibold outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 transition-all"
                  />
                  <button type="submit" className="bg-indigo-600 text-white w-12 h-12 rounded-xl flex items-center justify-center hover:bg-indigo-700 transition-all active:scale-95 shadow-lg shadow-indigo-100">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>

        {/* Modal Simplificado para Outras Abas */}
        {activeTab !== 'dashboard' && (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
             <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center text-gray-400">
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20v-6M9 20v-10M6 20v-4M15 20v-12M18 20v-16"/></svg>
             </div>
             <h3 className="text-xl font-black text-gray-800 uppercase tracking-tight">Conteúdo de {activeTab}</h3>
             <p className="text-gray-500 text-sm max-w-md">Esta funcionalidade está pronta para receber seus dados e interações conforme o modelo principal.</p>
             <button onClick={() => setActiveTab('dashboard')} className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-black text-[10px] tracking-widest uppercase shadow-xl shadow-indigo-100">Voltar ao Painel</button>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default App;