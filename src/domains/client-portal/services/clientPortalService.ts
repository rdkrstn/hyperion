import { makeId, nowIso } from '../../../shared/types/app';
import type { DealRecord } from '../../deals/types';
import type { ClientPortalRecord } from '../types';

export function createClientPortal(deal: DealRecord, origin = 'http://127.0.0.1:5173'): ClientPortalRecord {
  const token = `portal-${deal.id.replace(/[^a-z0-9]/gi, '').slice(-10)}-${Date.now().toString(36)}`;
  return {
    id: makeId('portal'),
    dealId: deal.id,
    token,
    publicUrl: `${origin}/portal/${token}`,
    status: 'active',
    createdAt: nowIso(),
  };
}
