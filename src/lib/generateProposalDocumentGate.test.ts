import { describe, expect, it } from 'vitest';
import { proposalRequiredDocumentsGate } from '../../supabase/functions/generate-proposal/documentGate';

describe('generate-proposal document gate', () => {
  it('accepts validated documents linked to the deal or to the source lead', () => {
    const gate = proposalRequiredDocumentsGate({
      dealId: 'deal-1',
      leadId: 'lead-1',
      documents: [
        { category: 'customer_bill', status: 'validated', deal_id: null, lead_id: 'lead-1', file_name: 'bill.pdf' },
        { category: 'valid_id', status: 'validated', deal_id: 'deal-1', lead_id: null, file_name: 'id.jpg' },
        { category: 'site_control_document', status: 'validated', deal_id: null, lead_id: 'lead-1', file_name: 'lease.pdf' },
      ],
    });

    expect(gate.allowed).toBe(true);
    expect(gate.missing).toEqual([]);
  });

  it('returns exact missing categories for proposal blockers', () => {
    const gate = proposalRequiredDocumentsGate({
      dealId: 'deal-1',
      leadId: 'lead-1',
      documents: [
        { category: 'customer_bill', status: 'validated', deal_id: 'deal-1', lead_id: null, file_name: 'bill.pdf' },
      ],
    });

    expect(gate.allowed).toBe(false);
    expect(gate.missingLabels).toEqual(['Valid ID', 'Site-Control Document']);
  });
});
