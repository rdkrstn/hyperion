import { describe, expect, it } from 'vitest';
import { seedDeals } from '../data/seed';
import {
  createRemoteIntakeLink,
  isRemoteIntakeExpired,
  markRemoteIntakeSent,
  recordRemoteIntakeUpload,
  requiredRemoteIntakeUploadCategories,
} from './remoteIntake';

describe('remote client intake links', () => {
  it('creates a 48-hour token scoped to one opportunity', () => {
    const link = createRemoteIntakeLink(seedDeals[0], 'https://solar.local', new Date('2026-05-20T00:00:00Z'));

    expect(link.dealId).toBe(seedDeals[0].id);
    expect(link.status).toBe('generated');
    expect(link.publicUrl).toContain('/remote-intake/');
    expect(link.expiresAt).toBe('2026-05-22T00:00:00.000Z');
    expect(isRemoteIntakeExpired(link, new Date('2026-05-22T00:00:01Z'))).toBe(true);
  });

  it('tracks manual send and required upload completion', () => {
    const sent = markRemoteIntakeSent(createRemoteIntakeLink(seedDeals[0]), 'sales');
    const completed = requiredRemoteIntakeUploadCategories.reduce(
      (link, category) => recordRemoteIntakeUpload(link, category, `${category}.jpg`, 'remote-client').link,
      sent,
    );

    expect(sent.status).toBe('sent');
    expect(completed.status).toBe('completed');
    expect(completed.uploads.map((upload) => upload.category).sort()).toEqual([...requiredRemoteIntakeUploadCategories].sort());
    expect(requiredRemoteIntakeUploadCategories).not.toContain('roof_photo');
  });
});
