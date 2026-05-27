import type { LinkedRecordType, NotificationRecord, NotificationSeverity, Role } from '../types';

function stamp() {
  return new Date().toLocaleString('en-PH');
}

function id(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

export function buildNotification(input: {
  title: string;
  body: string;
  targetRole?: Role;
  targetProfileId?: string;
  linkedRecordType: LinkedRecordType;
  linkedRecordId: string;
  severity: NotificationSeverity;
}): NotificationRecord {
  return {
    id: id('notification'),
    title: input.title,
    body: input.body,
    targetRole: input.targetRole,
    targetProfileId: input.targetProfileId,
    linkedRecordType: input.linkedRecordType,
    linkedRecordId: input.linkedRecordId,
    severity: input.severity,
    createdAt: stamp(),
  };
}

export function unreadNotificationsForProfile(
  notifications: NotificationRecord[],
  profile: { profileId: string; role: Role },
) {
  return notifications.filter((notification) => {
    if (notification.readAt) return false;
    if (notification.targetProfileId) return notification.targetProfileId === profile.profileId;
    return notification.targetRole === profile.role;
  });
}
