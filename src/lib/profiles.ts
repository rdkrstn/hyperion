import type { ProfilePreferences, StaffProfile } from '../types';

export const defaultProfilePreferences: ProfilePreferences = {
  notifyInApp: true,
  notifyLeadUpdates: true,
  notifySurveyUpdates: true,
  notifyFinancingUpdates: true,
  notifyOwnerApprovals: true,
};

export function applySelfProfileUpdate(profile: StaffProfile, input: Partial<StaffProfile>): StaffProfile {
  return {
    ...profile,
    fullName: input.fullName ?? profile.fullName,
    phone: input.phone ?? profile.phone,
    focus: input.focus ?? profile.focus,
    avatarInitials: input.avatarInitials ?? profile.avatarInitials,
    preferences: input.preferences ?? profile.preferences ?? defaultProfilePreferences,
    role: profile.role,
    active: profile.active,
    email: profile.email,
  };
}
