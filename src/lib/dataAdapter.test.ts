import { describe, expect, it } from 'vitest';
import { createHybridRepository, selectRepositoryMode } from './dataAdapter';

describe('hybrid data adapter', () => {
  it('starts with an empty local workspace when Supabase is not configured', () => {
    const repo = createHybridRepository(false);

    expect(selectRepositoryMode(false)).toBe('local');
    expect(repo.mode).toBe('local');
    expect(repo.deals).toEqual([]);
    expect(repo.clients).toEqual([]);
    expect(repo.staff).toEqual([]);
  });

  it('selects Supabase mode when configuration is present', () => {
    expect(selectRepositoryMode(true)).toBe('supabase');
    expect(createHybridRepository(true).mode).toBe('supabase');
  });

  it('supports local lead and client CRUD with archive restore behavior', () => {
    const repo = createHybridRepository(false);
    const createdLead = repo.createLead();

    expect(createdLead.ok).toBe(true);
    expect(repo.updateLead(createdLead.data!.id, { businessName: 'Updated Lead' }).data?.lead.businessName).toBe('Updated Lead');
    expect(repo.archiveLead(createdLead.data!.id).data?.archiveState).toBe('archived');
    expect(repo.restoreLead(createdLead.data!.id).data?.archiveState).toBe('active');

    const createdClient = repo.createClient({
      businessName: 'New Client',
      contactName: 'Client Contact',
      location: 'Iloilo',
      status: 'prospect',
      linkedDealId: createdLead.data!.id,
      commercialValue: 100000,
      nextAction: 'Follow up',
    });

    expect(createdClient.ok).toBe(true);
    expect(repo.updateClient(createdClient.data!.id, { status: 'active_client' }).data?.status).toBe('active_client');
    expect(repo.archiveClient(createdClient.data!.id).data?.archiveState).toBe('archived');
    expect(repo.restoreClient(createdClient.data!.id).data?.archiveState).toBe('active');
  });
});
