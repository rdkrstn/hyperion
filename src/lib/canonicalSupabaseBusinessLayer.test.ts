import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const migration = readFileSync(join(root, 'supabase/migrations/20260521183144_clean_domain_state_machine.sql'), 'utf8');

describe('canonical Supabase business layer', () => {
  it('uses the requested canonical table names and removes old preview table names', () => {
    for (const table of [
      'staff_profiles',
      'lead_energy_profiles',
      'lead_site_profiles',
      'qualification_sections',
      'bill_uploads',
      'solar_snapshots',
      'deal_commercial_packets',
      'remote_intake_tokens',
      'survey_evidence',
      'quote_line_items',
      'billing_invoices',
      'timeline_events',
      'notifications',
    ]) {
      expect(migration).toContain(`create table public.${table}`);
    }

    for (const oldName of [
      'create table public.profiles',
      'create table public.energy_profiles',
      'create table public.site_profiles',
      'create table public.proposal_estimates',
      'create table public.proposal_scope_lines',
      'create table public.survey_evidence_uploads',
      'create table public.payment_ledger_events',
    ]) {
      expect(migration).not.toContain(oldName);
    }
  });

  it('ships the Edge Function folders that own business mutations', () => {
    for (const functionName of [
      '_shared',
      'lead-intake',
      'bill-ocr-preaudit',
      'maps-enrichment',
      'solar-snapshot',
      'readiness-score',
      'remote-intake-create',
      'remote-intake-access',
      'remote-intake-upload',
      'document-signed-url',
      'document-validate',
      'survey-dispatch',
      'survey-evidence-upload',
      'generate-proposal',
      'generate-compliance-docs',
    ]) {
      expect(existsSync(join(root, 'supabase/functions', functionName))).toBe(true);
    }
  });
});
