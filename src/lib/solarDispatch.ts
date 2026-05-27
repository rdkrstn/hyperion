import { buildCalendarEvent } from './coreOps';
import { evaluateSolarApiGate } from './compliance';
import type { CalendarEvent, Deal, Role, SolarDispatchGate, SurveyScheduleInput } from '../types';

function stamp() {
  return new Date().toLocaleString('en-PH');
}

function id(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

export function evaluateSolarDispatchGate(deal: Deal, actorRole: Role): SolarDispatchGate {
  const solarGate = evaluateSolarApiGate(deal);
  if (solarGate.allowed) {
    return {
      allowed: true,
      status: deal.solarInsights?.ownerOverrideAt ? 'override_approved' : 'ready',
      reason: solarGate.reason,
      nextAction: 'Assign and schedule installer survey.',
    };
  }
  if (deal.solarDispatchOverride?.status === 'approved' && deal.solarInsights?.ownerOverrideAt) {
    return {
      allowed: true,
      status: 'override_approved',
      reason: deal.solarDispatchOverride.reviewReason ?? 'Manual dispatch approved.',
      nextAction: 'Assign and schedule installer survey with manual roof verification notes.',
    };
  }
  if (deal.solarDispatchOverride?.status === 'requested') {
    return {
      allowed: false,
      status: 'override_requested',
      reason: 'Solar API manual dispatch override is waiting for owner or manager review.',
      nextAction: actorRole === 'owner' || actorRole === 'manager' ? 'Approve or reject the dispatch override.' : 'Wait for owner or manager approval.',
    };
  }
  return {
    allowed: false,
    status: deal.solarInsights?.status ?? 'maps_pending',
    reason: `Solar API roof review is required before site visit. ${solarGate.reason}`,
    nextAction: actorRole === 'owner' || actorRole === 'manager' ? 'Approve a manual dispatch override or rerun Solar API.' : 'Request owner/manager override or confirm the site pin.',
  };
}

export function requestSolarDispatchOverride(deal: Deal, actorRole: Role, reason: string): Deal {
  if (!['sales', 'owner', 'manager'].includes(actorRole)) throw new Error('Only sales, owner, or manager can request Solar API dispatch override.');
  if (!reason.trim()) throw new Error('Override request reason is required.');
  return {
    ...deal,
    solarDispatchOverride: {
      status: 'requested',
      requestedByRole: actorRole,
      requestedAt: stamp(),
      requestReason: reason.trim(),
    },
  };
}

export function approveSolarDispatchOverride(deal: Deal, actorRole: Role, reason: string): Deal {
  if (actorRole !== 'owner' && actorRole !== 'manager') throw new Error('Only owner or manager can approve Solar API dispatch override.');
  if (!reason.trim()) throw new Error('Override approval reason is required.');
  const now = stamp();
  const solarInsights = deal.solarInsights ?? {
    id: id('solar'),
    status: 'maps_pending' as const,
    roofSegments: [],
    riskFlags: [],
    createdAt: now,
  };
  return {
    ...deal,
    solarInsights: {
      ...solarInsights,
      ownerOverrideAt: now,
      ownerOverrideReason: reason.trim(),
      riskFlags: Array.from(new Set([...(solarInsights.riskFlags ?? []), reason.trim()])),
    },
    solarDispatchOverride: {
      ...(deal.solarDispatchOverride ?? {
        status: 'requested' as const,
        requestedByRole: actorRole,
        requestedAt: now,
        requestReason: reason.trim(),
      }),
      status: 'approved',
      reviewedByRole: actorRole,
      reviewedAt: now,
      reviewReason: reason.trim(),
    },
  };
}

export function assignAndScheduleSurveyJob(
  deal: Deal,
  actorRole: Role,
  input: SurveyScheduleInput,
): { deal: Deal; calendarEvent: CalendarEvent } {
  if (!['sales', 'owner'].includes(actorRole)) throw new Error('Only sales or owner can assign installer surveys.');
  const dispatchGate = evaluateSolarDispatchGate(deal, actorRole);
  if (!dispatchGate.allowed) throw new Error(dispatchGate.reason);
  if (!input.assignedInstaller.trim()) throw new Error('Assigned installer is required.');
  if (!input.scheduledAt.trim()) throw new Error('Survey calendar slot is required.');
  if (!input.location.trim()) throw new Error('Survey location is required.');

  const surveyJobId = deal.surveyJob?.id ?? `survey-${deal.id}`;
  const calendarEvent = buildCalendarEvent({
    title: `Installer survey: ${deal.lead.businessName}`,
    linkedRecordType: 'survey',
    linkedRecordId: surveyJobId,
    startAt: input.scheduledAt,
    endAt: new Date(new Date(input.scheduledAt).getTime() + 90 * 60 * 1000).toISOString(),
    ownerRole: actorRole,
    type: 'survey',
    location: input.location,
    notes: input.notes ?? 'Solar API reviewed before dispatch.',
  });
  return {
    calendarEvent,
    deal: {
      ...deal,
      stage: 'survey_assigned',
      surveyJob: {
        id: surveyJobId,
        assignedInstaller: input.assignedInstaller.trim(),
        scheduledAt: input.scheduledAt,
        roofCondition: 'Pending',
        shading: 'Pending',
        usableRoofArea: '',
        mapPin: input.location,
        siteAccessNotes: input.notes ?? 'Review Solar API roof context before arrival.',
        photoPlaceholders: ['Main Breaker Panel', 'Roof Surface', 'Inverter Location', 'Wire Run Path'],
        roofStructurallySound: null,
        completed: false,
      },
    },
  };
}
