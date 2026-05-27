import { describe, expect, it } from 'vitest';
import {
  buildBillingLedgerEvent,
  buildCalendarEvent,
  buildReportEmbeddingChunk,
  buildReportSnapshot,
  buildSurveyUpload,
  buildTicket,
  canCompleteInstallerSurvey,
  qualificationSections,
  requiredSurveyUploadCategories,
  scoreQualification,
} from './coreOps';
import { sampleLeadInput, seedDeals } from '../data/seed';

describe('core operations production behavior', () => {
  it('qualifies leads from required solar sales sections and supports sales override', () => {
    const partial = scoreQualification(sampleLeadInput, {
      business_fit: true,
      bill_energy: true,
      site_control: false,
      financing_fit: true,
      decision_timeline: true,
      docs: false,
    });

    expect(qualificationSections.map((section) => section.id)).toEqual([
      'inquiry',
      'business_fit',
      'bill_energy',
      'site_control',
      'financing_fit',
      'decision_timeline',
      'docs',
      'notes',
    ]);
    expect(partial.status).toBe('qualifying');
    expect(partial.missingSections).toEqual(['site_control', 'docs']);

    const overridden = scoreQualification(sampleLeadInput, {
      business_fit: true,
      bill_energy: true,
      site_control: false,
      financing_fit: true,
      decision_timeline: true,
      docs: false,
    }, 'Building owner confirmed roof access and documents by phone.');

    expect(overridden.status).toBe('qualified');
    expect(overridden.overrideNote).toContain('roof access');
  });

  it('creates internal tickets and calendar events linked to operational records', () => {
    const ticket = buildTicket({
      linkedRecordType: 'lead',
      linkedRecordId: seedDeals[0].id,
      category: 'qualification',
      priority: 'high',
      title: 'Confirm decision maker',
      ownerRole: 'sales',
    });
    const event = buildCalendarEvent({
      title: 'Site survey',
      linkedRecordType: 'survey',
      linkedRecordId: 'survey-002',
      startAt: '2026-05-23T10:00',
      endAt: '2026-05-23T12:00',
      ownerRole: 'installer',
    });

    expect(ticket.status).toBe('open');
    expect(ticket.comments[0].body).toContain('Ticket created');
    expect(event.type).toBe('survey');
    expect(event.linkedRecordId).toBe('survey-002');
  });

  it('requires installers to upload the full evidence set before completing survey validation', () => {
    const uploads = requiredSurveyUploadCategories.map((category) => buildSurveyUpload({
      surveyJobId: 'survey-002',
      category,
      fileName: `${category}.jpg`,
      storagePath: `survey-002/${category}.jpg`,
      uploadedByRole: 'installer',
    }));

    expect(canCompleteInstallerSurvey(uploads.slice(0, -1), 'installer').allowed).toBe(false);
    expect(canCompleteInstallerSurvey(uploads.slice(0, -1), 'installer').reason).toContain('Missing survey evidence');
    expect(canCompleteInstallerSurvey(uploads, 'installer').allowed).toBe(false);
    expect(canCompleteInstallerSurvey(uploads, 'installer').reason).toContain('Roof structural soundness');
    expect(canCompleteInstallerSurvey(uploads, 'installer', false).allowed).toBe(false);
    expect(canCompleteInstallerSurvey(uploads, 'installer', false).reason).toContain('engineering remediation');
    expect(canCompleteInstallerSurvey(uploads, 'cs', true).allowed).toBe(false);
    expect(canCompleteInstallerSurvey(uploads, 'owner', true).allowed).toBe(false);
    expect(canCompleteInstallerSurvey(uploads, 'installer', true).allowed).toBe(true);
  });

  it('records real billing ledger events while keeping provider execution mocked', () => {
    const event = buildBillingLedgerEvent({
      linkedRecordId: 'lead-005',
      eventType: 'mock_payment_attempt',
      amount: 264000,
      actorRole: 'cs',
      note: 'Deposit attempt recorded.',
    });

    expect(event.providerMode).toBe('mock');
    expect(event.amount).toBe(264000);
  });

  it('creates owner or manager report snapshots with 1536-dimension embedding chunks', () => {
    const snapshot = buildReportSnapshot(seedDeals, 'manager');
    const chunk = buildReportEmbeddingChunk(snapshot, new Array(1536).fill(0.01));

    expect(snapshot.status).toBe('embedded');
    expect(snapshot.summary).toContain('Revenue operations');
    expect(chunk.embedding.length).toBe(1536);
    expect(chunk.model).toBe('text-embedding-3-small');
  });
});
