export type Role = 'owner' | 'manager' | 'sales' | 'cs' | 'installer' | 'client';

export interface ActionResult<T = unknown> {
  ok: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface StageAction {
  id: string;
  label: string;
  enabled: boolean;
  reason: string;
  href?: string;
}

export interface TimelineEvent {
  id: string;
  ownerType: 'lead' | 'deal' | 'survey' | 'document' | 'proposal' | 'client';
  ownerId: string;
  title: string;
  description: string;
  actorRole: Role | 'system';
  createdAt: string;
}

export function makeId(prefix: string) {
  const random = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID().slice(0, 8)
    : Math.random().toString(16).slice(2, 10);
  return `${prefix}-${Date.now()}-${random}`;
}

export function nowIso() {
  return new Date().toISOString();
}

export const peso = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  maximumFractionDigits: 0,
});
