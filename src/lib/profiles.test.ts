import { describe, expect, it } from 'vitest';
import { applySelfProfileUpdate } from './profiles';
import type { StaffProfile } from '../types';

const profile: StaffProfile = {
  id: 'staff-sales',
  fullName: 'Ana Sales',
  email: 'sales@solarops.local',
  role: 'sales',
  active: true,
  focus: 'Lead capture',
};

describe('employee profiles', () => {
  it('allows self-editable fields without changing role or active status', () => {
    const updated = applySelfProfileUpdate(profile, {
      fullName: 'Ana Updated',
      phone: '+63 900 000 0000',
      focus: 'Readiness qualification',
      avatarInitials: 'AU',
      role: 'owner',
      active: false,
    });

    expect(updated.fullName).toBe('Ana Updated');
    expect(updated.phone).toBe('+63 900 000 0000');
    expect(updated.avatarInitials).toBe('AU');
    expect(updated.role).toBe('sales');
    expect(updated.active).toBe(true);
  });
});
