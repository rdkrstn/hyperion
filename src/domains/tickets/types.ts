export interface TicketRecord {
  id: string;
  title: string;
  category: 'qualification' | 'survey' | 'documents' | 'proposal' | 'support';
  status: 'open' | 'in_progress' | 'resolved';
  priority: 'low' | 'medium' | 'high';
  linkedLeadId?: string;
  linkedDealId?: string;
  createdAt: string;
}
