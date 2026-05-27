import { describe, expect, it } from 'vitest';
import { seedDeals } from '../data/seed';
import { createDealRoom, recordDealRoomEvent, requestDealRoomQuote } from './dealRoom';

describe('MSME deal room', () => {
  it('creates a public token room without customer-facing AI content', () => {
    const room = createDealRoom(seedDeals[2], 'http://127.0.0.1:5173');

    expect(room.publicUrl).toContain('/portal/');
    expect(room.status).toBe('active');
    expect(room.sections.readinessScore).toBeGreaterThan(0);
    expect(`${room.sections.valueStory} ${room.sections.financingOptions.join(' ')}`.toLowerCase()).not.toContain('ai explainer');
  });

  it('tracks public view and formal quote request events', () => {
    const room = createDealRoom(seedDeals[2]);
    const viewed = recordDealRoomEvent(room, 'viewed');
    const quoted = requestDealRoomQuote(viewed, {
      contactName: 'Maria Santos',
      phone: '09171234567',
      note: 'Please send the formal quote.',
    });

    expect(quoted.events.map((event) => event.eventType)).toEqual(['quote_requested', 'viewed']);
    expect(quoted.quoteRequest?.status).toBe('requested');
  });
});
