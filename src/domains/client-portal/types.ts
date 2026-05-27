export interface ClientPortalRecord {
  id: string;
  dealId: string;
  token: string;
  publicUrl: string;
  status: 'active' | 'paused' | 'expired';
  lastViewedAt?: string;
  createdAt: string;
}
