const requiredDocumentCategories = ['customer_bill', 'valid_id', 'site_control_document'] as const;

export type ProposalDocumentCategory = typeof requiredDocumentCategories[number];

export type ProposalGateDocumentRow = {
  category: string;
  status: string;
  deal_id?: string | null;
  lead_id?: string | null;
  file_name?: string | null;
};

const labels: Record<ProposalDocumentCategory, string> = {
  customer_bill: 'Customer Bill',
  valid_id: 'Valid ID',
  site_control_document: 'Site-Control Document',
};

export function proposalRequiredDocumentsGate(input: {
  dealId: string;
  leadId: string;
  documents: ProposalGateDocumentRow[];
}) {
  const linked = input.documents.filter((document) => (
    document.deal_id === input.dealId || document.lead_id === input.leadId
  ));
  const requirements = requiredDocumentCategories.map((category) => {
    const matchedDocument = linked.find((document) => document.category === category && document.status === 'validated')
      ?? linked.find((document) => document.category === category);
    const passed = matchedDocument?.status === 'validated';
    return {
      category,
      label: labels[category],
      passed,
      matchedDocument,
      status: matchedDocument?.status ?? 'missing',
      blockingReason: passed ? undefined : `${labels[category]} must be uploaded and validated.`,
    };
  });
  const missing = requirements.filter((requirement) => !requirement.passed);
  return {
    allowed: missing.length === 0,
    requirements,
    missing: missing.map((requirement) => requirement.category),
    missingLabels: missing.map((requirement) => requirement.label),
    reason: missing.length ? `Validated documents are required: ${missing.map((requirement) => requirement.label).join(', ')}.` : 'Required documents are validated.',
  };
}
