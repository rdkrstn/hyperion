import { isSupabaseConfigured } from './supabase';
import { defaultQualification } from './coreOps';
import { readinessToLeadInput, sampleReadinessIntake } from './readiness';
import type { ClientFormInput, ClientRecord, Deal, LeadFormInput, RepositoryResult, StaffProfile } from '../types';

export type RepositoryMode = 'supabase' | 'local';

export function selectRepositoryMode(configured = isSupabaseConfigured): RepositoryMode {
  return configured ? 'supabase' : 'local';
}

function cloneDeal(deal: Deal): Deal {
  return structuredClone(deal);
}

function cloneClient(client: ClientRecord): ClientRecord {
  return structuredClone(client);
}

export function createLocalRepository(initialDeals: Deal[] = [], initialClients: ClientRecord[] = [], initialStaff: StaffProfile[] = []) {
  let deals = initialDeals.map(cloneDeal);
  let clients = initialClients.map(cloneClient);

  return {
    mode: 'local' as const,
    get deals() {
      return deals;
    },
    staff: initialStaff,
    get clients() {
      return clients;
    },
    createLead(input: LeadFormInput = readinessToLeadInput(sampleReadinessIntake)): RepositoryResult<Deal> {
      const id = `lead-local-${deals.length + 1}`;
      const deal: Deal = {
        id,
        code: `SOL-${String(deals.length + 1).padStart(3, '0')}`,
        stage: 'captured',
        opportunityStatus: 'open',
        archiveState: 'active',
        archivedAt: undefined,
        lead: input,
        qualification: defaultQualification(input),
        assignedSales: '',
        readinessUploads: [],
        preAudit: undefined,
        score: undefined,
        surveyJob: undefined,
        checkoutEstimate: undefined,
        contract: undefined,
        proposal: undefined,
        invoice: undefined,
        billingTransaction: undefined,
        cancellation: undefined,
        refund: undefined,
        documents: {
          electricBills: false,
          businessRegistration: false,
          validId: false,
          locationPin: false,
          roofAccess: false,
        },
        billingLedger: [],
        surveyUploads: [],
        quoteRequests: [],
        csReady: false,
        tasks: [],
        aiSuggestions: [],
        events: [{
          id: `event-${Date.now()}`,
          stage: 'captured',
          actorRole: 'sales',
          note: 'Lead created.',
          createdAt: new Date().toLocaleString('en-PH'),
        }],
      };
      deals = [deal, ...deals];
      return { ok: true, data: deal };
    },
    updateLead(id: string, input: Partial<LeadFormInput>): RepositoryResult<Deal> {
      const existing = deals.find((deal) => deal.id === id);
      if (!existing) return { ok: false, error: 'Lead not found.' };
      deals = deals.map((deal) => (deal.id === id ? { ...deal, lead: { ...deal.lead, ...input } } : deal));
      return { ok: true, data: deals.find((deal) => deal.id === id) };
    },
    archiveLead(id: string): RepositoryResult<Deal> {
      const existing = deals.find((deal) => deal.id === id);
      if (!existing) return { ok: false, error: 'Lead not found.' };
      deals = deals.map((deal) => (deal.id === id ? { ...deal, archiveState: 'archived', archivedAt: new Date().toLocaleString('en-PH'), opportunityStatus: 'archived' } : deal));
      return { ok: true, data: deals.find((deal) => deal.id === id) };
    },
    restoreLead(id: string): RepositoryResult<Deal> {
      const existing = deals.find((deal) => deal.id === id);
      if (!existing) return { ok: false, error: 'Lead not found.' };
      deals = deals.map((deal) => (deal.id === id ? { ...deal, archiveState: 'active', archivedAt: undefined, opportunityStatus: deal.opportunityStatus === 'archived' ? 'open' : deal.opportunityStatus } : deal));
      return { ok: true, data: deals.find((deal) => deal.id === id) };
    },
    createClient(input: ClientFormInput): RepositoryResult<ClientRecord> {
      const client: ClientRecord = { id: `client-local-${clients.length + 1}`, archiveState: 'active', ...input };
      clients = [client, ...clients];
      return { ok: true, data: client };
    },
    updateClient(id: string, input: Partial<ClientFormInput>): RepositoryResult<ClientRecord> {
      const existing = clients.find((client) => client.id === id);
      if (!existing) return { ok: false, error: 'Client not found.' };
      clients = clients.map((client) => (client.id === id ? { ...client, ...input } : client));
      return { ok: true, data: clients.find((client) => client.id === id) };
    },
    archiveClient(id: string): RepositoryResult<ClientRecord> {
      const existing = clients.find((client) => client.id === id);
      if (!existing) return { ok: false, error: 'Client not found.' };
      clients = clients.map((client) => (client.id === id ? { ...client, archiveState: 'archived', archivedAt: new Date().toLocaleString('en-PH') } : client));
      return { ok: true, data: clients.find((client) => client.id === id) };
    },
    restoreClient(id: string): RepositoryResult<ClientRecord> {
      const existing = clients.find((client) => client.id === id);
      if (!existing) return { ok: false, error: 'Client not found.' };
      clients = clients.map((client) => (client.id === id ? { ...client, archiveState: 'active', archivedAt: undefined } : client));
      return { ok: true, data: clients.find((client) => client.id === id) };
    },
  };
}

export function createHybridRepository(configured = isSupabaseConfigured) {
  if (!configured) return createLocalRepository();
  return {
    ...createLocalRepository(),
    mode: 'supabase' as const,
  };
}
