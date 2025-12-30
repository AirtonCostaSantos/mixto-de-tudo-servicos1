
export enum ServiceStatus {
  PENDING = 'Pendente',
  APPROVED = 'Aprovado',
  IN_PROGRESS = 'Em Andamento',
  COMPLETED = 'Concluído',
  CANCELED = 'Cancelado'
}

export enum TaskStatus {
  PENDING = 'Pendente',
  COMPLETED = 'Concluído',
  DELAYED = 'Atrasado'
}

export interface ProjectTask {
  id: string;
  description: string;
  stage: 'Planejamento' | 'Execução';
  status: TaskStatus;
}

export interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  document: string; // CPF or CNPJ
}

export interface ServiceType {
  id: string;
  name: string;
  description: string;
  basePrice: number;
  unit: string; // e.g., m², hora, un
}

export interface Material {
  id: string;
  name: string;
  unitPrice: number;
  stock: number;
  unit: string; // e.g., kg, un, metro
}

export interface BudgetItem {
  id: string;
  quantity: number;
  unitPrice: number;
}

export interface Budget {
  id: string;
  clientId: string;
  services: BudgetItem[];
  materials: BudgetItem[];
  totalValue: number;
  date: string;
  status: ServiceStatus;
  description: string;
  tasks: ProjectTask[];
}

export interface DashboardStats {
  totalClients: number;
  totalBudgets: number;
  totalRevenue: number;
  activeServices: number;
}

export interface ChartDataPoint {
  date: string;
  value: number;
}
