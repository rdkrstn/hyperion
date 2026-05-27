import { ApiError } from '../_shared/errors.ts';
import { assertRole, loadStaffProfile } from '../_shared/auth.ts';
import { createSupabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { logTimeline } from '../_shared/timeline.ts';
import { createSurveyDispatchHandler } from './handler.ts';

const supabase = createSupabaseAdmin();

Deno.serve(async (request) => {
  const profile = request.method === 'OPTIONS'
    ? undefined
    : await loadStaffProfile(supabase, request.headers.get('authorization'));
  if (profile) assertRole(profile.role, ['owner', 'manager', 'sales']);

  return createSurveyDispatchHandler({
    async dispatchSurvey({ dealId, installerId, schedule, location }) {
      if (!profile) throw new ApiError('forbidden', 'Staff profile is required.', 403);
      if (!dealId) throw new ApiError('bad_request', 'deal_id is required because surveys belong to deals.', 400);

      const { data: deal, error: dealError } = await supabase
        .from('deals')
        .select('id,lead_id,name,stage')
        .eq('id', dealId)
        .maybeSingle();
      if (dealError) throw dealError;
      if (!deal) throw new ApiError('not_found', 'Deal not found.', 404);

      const { data: snapshot, error: snapshotError } = await supabase
        .from('solar_snapshots')
        .select('id,dispatch_gate,recommended_next_action')
        .or(`deal_id.eq.${dealId},lead_id.eq.${deal.lead_id}`)
        .order('reviewed_at', { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle();
      if (snapshotError) throw snapshotError;
      if (!snapshot || !['ready', 'override_approved'].includes(snapshot.dispatch_gate)) {
        throw new ApiError(
          'forbidden',
          snapshot?.recommended_next_action ?? 'Solar Snapshot must be ready or overridden before survey dispatch.',
          403,
        );
      }

      const { data: survey, error: surveyError } = await supabase.from('surveys').insert({
        lead_id: deal.lead_id,
        deal_id: dealId,
        installer_id: installerId,
        scheduled_at: schedule,
        location,
        solar_snapshot_id: snapshot.id,
        validation_status: 'scheduled',
      }).select('id').single();
      if (surveyError) throw surveyError;

      const { data: event, error: eventError } = await supabase.from('calendar_events').insert({
        type: 'survey',
        linked_deal_id: dealId,
        linked_survey_id: survey.id,
        title: `Survey: ${deal.name}`,
        start_at: schedule,
        location,
      }).select('id').single();
      if (eventError) throw eventError;

      const responses = await Promise.all([
        supabase.from('deals').update({
          stage: 'survey_scheduled',
          survey_status: 'scheduled',
          next_best_action: 'Installer must upload required evidence and validate the survey.',
          updated_at: new Date().toISOString(),
        }).eq('id', dealId),
        supabase.from('notifications').insert({
          target_profile_id: installerId,
          title: 'Survey assigned',
          body: `${deal.name} is scheduled at ${location}.`,
          linked_record_type: 'survey',
          linked_record_id: survey.id,
        }),
      ]);
      const failed = responses.find((response) => response.error);
      if (failed?.error) throw failed.error;

      await logTimeline(supabase, {
        ownerType: 'deal',
        ownerId: dealId,
        leadId: deal.lead_id,
        dealId,
        surveyId: survey.id,
        title: 'Survey scheduled',
        description: `Installer assigned for ${schedule} at ${location}.`,
        actorRole: profile.role,
      });
      return {
        survey_id: survey.id,
        calendar_event_id: event.id,
      };
    },
  })(request);
});
