import { describe, expect, it } from 'vitest';
import { buildNotification, unreadNotificationsForProfile } from './notifications';

describe('role notifications', () => {
  it('routes notifications to role and profile targets and counts unread items', () => {
    const sales = buildNotification({
      title: 'New readiness intake',
      body: 'A customer submitted an intake.',
      targetRole: 'sales',
      linkedRecordType: 'lead',
      linkedRecordId: 'lead-1',
      severity: 'info',
    });
    const owner = buildNotification({
      title: 'Owner approval needed',
      body: 'A packet is ready.',
      targetProfileId: 'owner-profile',
      targetRole: 'owner',
      linkedRecordType: 'owner_review',
      linkedRecordId: 'lead-1',
      severity: 'warning',
    });

    expect(unreadNotificationsForProfile([sales, owner], { profileId: 'sales-profile', role: 'sales' })).toHaveLength(1);
    expect(unreadNotificationsForProfile([sales, owner], { profileId: 'owner-profile', role: 'owner' })).toHaveLength(1);
  });

  it('excludes read notifications from unread counts', () => {
    const notification = {
      ...buildNotification({
        title: 'Survey upload missing',
        body: 'Installer needs required files.',
        targetRole: 'installer',
        linkedRecordType: 'survey',
        linkedRecordId: 'survey-1',
        severity: 'warning',
      }),
      readAt: '2026-05-20 10:00',
    };

    expect(unreadNotificationsForProfile([notification], { profileId: 'installer-profile', role: 'installer' })).toEqual([]);
  });
});
