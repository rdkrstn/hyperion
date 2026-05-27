export async function logTimeline(
  supabase: { from: (table: string) => any },
  input: {
    ownerType: string;
    ownerId: string;
    title: string;
    description?: string;
    actorRole?: string;
    leadId?: string;
    dealId?: string;
    surveyId?: string;
    documentId?: string;
    proposalId?: string;
    metadata?: Record<string, unknown>;
  },
) {
  const { error } = await supabase.from('timeline_events').insert({
    owner_type: input.ownerType,
    owner_id: input.ownerId,
    lead_id: input.leadId,
    deal_id: input.dealId,
    survey_id: input.surveyId,
    document_id: input.documentId,
    proposal_id: input.proposalId,
    title: input.title,
    description: input.description ?? '',
    actor_role: input.actorRole ?? 'system',
    metadata: input.metadata ?? {},
  });
  if (error) throw error;
}
