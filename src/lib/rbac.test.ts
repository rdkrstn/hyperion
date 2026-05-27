import { describe, expect, it } from 'vitest';
import { canRolePerform } from './rbac';

describe('role permissions', () => {
  it('keeps survey completion installer-owned and final approval owner-owned', () => {
    expect(canRolePerform('installer', 'complete_survey')).toBe(true);
    expect(canRolePerform('sales', 'complete_survey')).toBe(false);
    expect(canRolePerform('cs', 'complete_survey')).toBe(false);
    expect(canRolePerform('owner', 'complete_survey')).toBe(false);
    expect(canRolePerform('cs', 'validate_survey')).toBe(false);
    expect(canRolePerform('owner', 'approve_owner_review')).toBe(true);
  });

  it('keeps CS focused on documents and payment readiness', () => {
    expect(canRolePerform('cs', 'submit_owner_review')).toBe(true);
    expect(canRolePerform('cs', 'run_pre_audit')).toBe(false);
    expect(canRolePerform('sales', 'submit_owner_review')).toBe(false);
  });

  it('keeps checkout with sales and owner only', () => {
    expect(canRolePerform('sales', 'manage_checkout')).toBe(true);
    expect(canRolePerform('owner', 'manage_checkout')).toBe(true);
    expect(canRolePerform('cs', 'manage_checkout')).toBe(false);
    expect(canRolePerform('installer', 'manage_checkout')).toBe(false);
  });

  it('keeps quote requests with sales and owner only', () => {
    expect(canRolePerform('sales', 'manage_quote_request')).toBe(true);
    expect(canRolePerform('owner', 'manage_quote_request')).toBe(true);
    expect(canRolePerform('manager', 'manage_quote_request')).toBe(false);
    expect(canRolePerform('installer', 'manage_quote_request')).toBe(false);
  });

  it('restricts AI report summaries to owner and manager', () => {
    expect(canRolePerform('owner', 'approve_ai_suggestion')).toBe(true);
    expect(canRolePerform('manager', 'approve_ai_suggestion')).toBe(true);
    expect(canRolePerform('sales', 'approve_ai_suggestion')).toBe(false);
    expect(canRolePerform('cs', 'approve_ai_suggestion')).toBe(false);
    expect(canRolePerform('installer', 'approve_ai_suggestion')).toBe(false);
  });

  it('requires owner approval for refunds', () => {
    expect(canRolePerform('sales', 'request_refund')).toBe(true);
    expect(canRolePerform('cs', 'request_refund')).toBe(true);
    expect(canRolePerform('owner', 'approve_refund')).toBe(true);
    expect(canRolePerform('cs', 'approve_refund')).toBe(false);
  });
});
