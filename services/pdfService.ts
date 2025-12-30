
import { Budget, Client, ServiceType, Material } from '../types';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

/**
 * Gera o texto formatado para compartilhamento via WhatsApp.
 */
export const generateBudgetSummaryText = (
  budget: Budget,
  client: Client | undefined,
  services: ServiceType[],
  materials: Material[]
) => {
  const serviceList = budget.services.map(item => {
    const srv = services.find(s => s.id === item.id);
    return srv ? `${srv.name} (${item.quantity} ${srv.unit})` : '';
  }).filter(Boolean).join('%0A- ');

  const materialList = budget.materials.map(item => {
    const mat = materials.find(m => m.id === item.id);
    return mat ? `${mat.name} (${item.quantity} ${mat.unit})` : '';
  }).filter(Boolean).join('%0A- ');

  return `*ORÇAMENTO - MIXTO DE TUDO SERVIÇOS*%0A%0A` +
    `*Cliente:* ${client?.name || 'Não informado'}%0A` +
    `*Data:* ${new Date(budget.date).toLocaleDateString()}%0A%0A` +
    `*Serviços:*%0A- ${serviceList || 'Nenhum'}%0A%0A` +
    `*Materiais:*%0A- ${materialList || 'Nenhum'}%0A%0A` +
    `*VALOR TOTAL:* R$ ${budget.totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}%0A%0A` +
    `_Status: ${budget.status}_%0A` +
    `Obrigado pela preferência!`;
};

/**
 * Abre o WhatsApp com a mensagem do orçamento.
 */
export const openWhatsApp = (phone: string, text: string) => {
  const cleanPhone = phone.replace(/\D/g, '');
  const url = `https://wa.me/${cleanPhone}?text=${text}`;
  window.open(url, '_blank');
};

/**
 * Gera e faz o download do relatório PDF do orçamento.
 */
export const generateBudgetPDF = (
  budget: Budget,
  client: Client | undefined,
  services: ServiceType[],
  materials: Material[]
) => {
  try {
    // Instancia o jsPDF. Em alguns ambientes ESM, pode ser necessário novo jsPDF()
    const doc = new jsPDF() as any;
    const pageWidth = doc.internal.pageSize.getWidth();

    // Cabeçalho Profissional
    doc.setFontSize(22);
    doc.setTextColor(30, 58, 138); // Indigo 900
    doc.setFont('helvetica', 'bold');
    doc.text('MIXTO DE TUDO', pageWidth / 2, 20, { align: 'center' });
    
    doc.setFontSize(10);
    doc.setTextColor(75, 85, 99); // Gray 600
    doc.setFont('helvetica', 'normal');
    doc.text('CONSTRUINDO E REFORMANDO SEUS SONHOS', pageWidth / 2, 27, { align: 'center' });
    
    doc.setFontSize(9);
    doc.text('Av Carlos Drummond de Andrade, 160 - Japiim', pageWidth / 2, 33, { align: 'center' });
    doc.text('Contato: (92) 98809-1790', pageWidth / 2, 38, { align: 'center' });

    // Divisor
    doc.setDrawColor(229, 231, 235);
    doc.line(20, 45, pageWidth - 20, 45);

    // Informações do Orçamento
    doc.setFontSize(14);
    doc.setTextColor(31, 41, 55);
    doc.setFont('helvetica', 'bold');
    doc.text(`Orçamento #${budget.id.toUpperCase()}`, 20, 55);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Data: ${new Date(budget.date).toLocaleDateString('pt-BR')}`, pageWidth - 20, 55, { align: 'right' });

    // Bloco de Informações do Cliente
    doc.setFillColor(249, 250, 251);
    doc.rect(20, 62, pageWidth - 40, 25, 'F');
    doc.setFont('helvetica', 'bold');
    doc.text('CLIENTE:', 25, 69);
    doc.setFont('helvetica', 'normal');
    doc.text(`${client?.name || 'Não informado'}`, 50, 69);
    doc.text(`CPF/CNPJ: ${client?.document || 'N/A'}`, 25, 76);
    doc.text(`Tel: ${client?.phone || 'N/A'}`, 120, 76);
    doc.text(`Endereço: ${client?.address || 'N/A'}`, 25, 83);

    let currentY = 95;

    // Tabela de Serviços
    if (budget.services && budget.services.length > 0) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text('SERVIÇOS', 20, currentY);
      currentY += 5;

      const serviceRows = budget.services.map(item => {
        const srv = services.find(s => s.id === item.id);
        const subtotal = item.quantity * item.unitPrice;
        return [
          srv?.name || 'Serviço não encontrado',
          `${item.quantity} ${srv?.unit || 'un'}`,
          `R$ ${item.unitPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
          `R$ ${subtotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
        ];
      });

      autoTable(doc, {
        startY: currentY,
        head: [['Descrição', 'Quantidade', 'Preço Unitário', 'Subtotal']],
        body: serviceRows,
        theme: 'striped',
        headStyles: { fillColor: [79, 70, 229] },
        margin: { left: 20, right: 20 },
      });
      
      currentY = (doc as any).lastAutoTable.finalY + 15;
    }

    // Tabela de Materiais
    if (budget.materials && budget.materials.length > 0) {
      if (currentY > 250) { doc.addPage(); currentY = 20; }
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text('MATERIAIS', 20, currentY);
      currentY += 5;

      const materialRows = budget.materials.map(item => {
        const mat = materials.find(m => m.id === item.id);
        const subtotal = item.quantity * item.unitPrice;
        return [
          mat?.name || 'Material não encontrado',
          `${item.quantity} ${mat?.unit || 'un'}`,
          `R$ ${item.unitPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
          `R$ ${subtotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
        ];
      });

      autoTable(doc, {
        startY: currentY,
        head: [['Descrição', 'Quantidade', 'Preço Unitário', 'Subtotal']],
        body: materialRows,
        theme: 'striped',
        headStyles: { fillColor: [16, 185, 129] },
        margin: { left: 20, right: 20 },
      });

      currentY = (doc as any).lastAutoTable.finalY + 15;
    }

    // Totais e Fechamento
    if (currentY > 260) { doc.addPage(); currentY = 20; }
    
    doc.setDrawColor(79, 70, 229);
    doc.setLineWidth(0.5);
    doc.line(pageWidth - 90, currentY, pageWidth - 20, currentY);
    
    currentY += 10;
    doc.setFontSize(16);
    doc.setTextColor(79, 70, 229);
    doc.setFont('helvetica', 'bold');
    doc.text('TOTAL GERAL:', pageWidth - 90, currentY);
    doc.text(`R$ ${budget.totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, pageWidth - 20, currentY, { align: 'right' });

    doc.setFontSize(10);
    doc.setTextColor(107, 114, 128);
    doc.setFont('helvetica', 'normal');
    doc.text('Este orçamento tem validade de 15 dias.', 20, currentY + 15);
    doc.text('Assinatura do Responsável: _________________________________', 20, currentY + 30);

    // Salva o documento
    doc.save(`orcamento_${budget.id}.pdf`);
  } catch (error) {
    console.error('Erro ao gerar PDF:', error);
    alert('Ocorreu um erro ao gerar o relatório PDF. Verifique os dados e tente novamente.');
  }
};
