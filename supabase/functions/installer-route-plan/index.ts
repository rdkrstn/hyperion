import { createSupabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { logTimeline } from '../_shared/timeline.ts';
import { buildInstallerRoutePlan } from '../../../src/lib/geoSolar.ts';
import type { InstallerRouteStop } from '../../../src/types.ts';
import { createInstallerRoutePlanHandler } from './handler.ts';

const supabase = createSupabaseAdmin();
const googleMapsServerKey = Deno.env.get('GOOGLE_MAPS_SERVER_KEY');

function parseDurationSeconds(duration?: string) {
  const match = duration?.match(/^(\d+(?:\.\d+)?)s$/);
  return match ? Number(match[1]) : undefined;
}

Deno.serve(createInstallerRoutePlanHandler({
  async buildRoutePlan({ installerId, origin }) {
    const { data: surveys, error: surveysError } = await supabase
      .from('surveys')
      .select(`
        id,
        lead_id,
        deal_id,
        location,
        scheduled_at,
        leads ( business_name ),
        lead_site_profiles ( latitude, longitude )
      `)
      .eq('installer_id', installerId)
      .in('validation_status', ['scheduled', 'evidence_pending']);
    if (surveysError) throw surveysError;

    const jobs: InstallerRouteStop[] = (surveys ?? []).map((survey: any, index: number) => {
      const site = Array.isArray(survey.lead_site_profiles) ? survey.lead_site_profiles[0] : survey.lead_site_profiles;
      return {
        dealId: survey.deal_id,
        surveyJobId: survey.id,
        label: survey.leads?.business_name ?? survey.location ?? `Survey ${index + 1}`,
        latitude: site?.latitude === null || site?.latitude === undefined ? undefined : Number(site.latitude),
        longitude: site?.longitude === null || site?.longitude === undefined ? undefined : Number(site.longitude),
      };
    });

    let matrix: Array<{ dealId: string; durationMinutes: number; distanceKm: number }> | undefined;
    if (googleMapsServerKey && origin?.latitude !== undefined && origin.longitude !== undefined && jobs.every((job) => job.latitude !== undefined && job.longitude !== undefined)) {
      const response = await fetch('https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': googleMapsServerKey,
          'X-Goog-FieldMask': 'originIndex,destinationIndex,duration,distanceMeters,status',
        },
        body: JSON.stringify({
          origins: [{ waypoint: { location: { latLng: { latitude: origin.latitude, longitude: origin.longitude } } } }],
          destinations: jobs.map((job) => ({ waypoint: { location: { latLng: { latitude: job.latitude, longitude: job.longitude } } } })),
          travelMode: 'DRIVE',
        }),
      });
      if (response.ok) {
        const rows = await response.json() as Array<{ destinationIndex?: number; duration?: string; distanceMeters?: number }>;
        matrix = rows.map((row) => {
          const job = jobs[row.destinationIndex ?? 0];
          const seconds = parseDurationSeconds(row.duration);
          return {
            dealId: job.dealId,
            durationMinutes: seconds === undefined ? 0 : Math.round(seconds / 60),
            distanceKm: Number(((row.distanceMeters ?? 0) / 1000).toFixed(1)),
          };
        });
      }
    }

    const plan = buildInstallerRoutePlan({ installerId, origin: origin ?? {}, jobs, matrix });
    if (plan.orderedStops[0]) {
      await logTimeline(supabase, {
        ownerType: 'survey',
        ownerId: plan.orderedStops[0].surveyJobId,
        surveyId: plan.orderedStops[0].surveyJobId,
        dealId: plan.orderedStops[0].dealId,
        title: 'Installer route plan generated',
        description: `${plan.orderedStops.length} survey stops ordered for the installer.`,
        actorRole: 'system',
      });
    }
    return { ...plan, id: crypto.randomUUID() };
  },
}));
