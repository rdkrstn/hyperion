import { describe, expect, it } from 'vitest';
import { automationRecipes, buildDemoAutomationEvents, simulateAutomationEvent } from './automationService';

describe('automation handoff recipes', () => {
  it('defines local n8n-ready recipes without requiring external calls', () => {
    expect(automationRecipes).toHaveLength(6);
    expect(automationRecipes.map((recipe) => recipe.id)).toEqual([
      'lead_captured',
      'documents_missing',
      'proposal_sent',
      'survey_validated',
      'net_metering_blocked',
      'contract_ready',
    ]);
    expect(automationRecipes.every((recipe) => recipe.defaultMode === 'local_simulation')).toBe(true);
    expect(automationRecipes.find((recipe) => recipe.id === 'lead_captured')?.envVar).toBe('VITE_N8N_WEBHOOK_LEAD_CAPTURED');
  });

  it('builds a stable simulated event log for the golden demo account', () => {
    const events = buildDemoAutomationEvents('Iloilo Mini Mart');

    expect(events).toHaveLength(6);
    expect(events[0]).toMatchObject({
      recipeId: 'lead_captured',
      sourceModule: 'Pipeline',
      mode: 'local_simulation',
      accountName: 'Iloilo Mini Mart',
    });
    expect(events.some((event) => event.eventName === 'Net-metering blocker task created')).toBe(true);
  });

  it('never dispatches to a webhook unless explicitly enabled', async () => {
    const calls: string[] = [];
    const event = await simulateAutomationEvent({
      recipeId: 'contract_ready',
      accountName: 'Iloilo Mini Mart',
      automationMode: 'local',
      env: { VITE_N8N_WEBHOOK_CONTRACT_READY: 'https://n8n.example/webhook/contract-ready' },
      fetcher: async (url) => {
        calls.push(String(url));
        return new Response('{}', { status: 200 });
      },
    });

    expect(event.mode).toBe('local_simulation');
    expect(event.status).toBe('simulated');
    expect(calls).toEqual([]);
  });
});
