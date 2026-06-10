import { describe, expect, it } from 'vitest';
import { createInitialSolarOpsState, createSolarOpsActions } from '../api/solarOpsStore';
import { buildGoldenDemoModel, goldenDemoStepIds } from './goldenDemo';

describe('golden demo model', () => {
  it('starts empty and instructs visitors to load the Hyperion golden demo', () => {
    const model = buildGoldenDemoModel(createInitialSolarOpsState());

    expect(model.loaded).toBe(false);
    expect(model.accountName).toBe('Iloilo Mini Mart');
    expect(model.currentStepId).toBe('load_demo');
    expect(model.nextAction).toBe('Load golden demo');
    expect(model.blockers).toContain('Golden demo data is not loaded.');
  });

  it('models the seeded Iloilo Mini Mart account as a snapshot-ready documents-and-survey blocker', () => {
    let state = createInitialSolarOpsState();
    const actions = createSolarOpsActions(() => state, (next) => { state = next; });
    actions.loadGoldenDemo();

    const model = buildGoldenDemoModel(state);

    expect(model.loaded).toBe(true);
    expect(model.accountName).toBe('Iloilo Mini Mart');
    expect(model.currentStepId).toBe('docs');
    expect(model.progressPercent).toBeGreaterThanOrEqual(40);
    expect(model.metrics).toMatchObject({
      readinessScore: 86,
      monthlyBill: 45000,
      roofCapacityKwp: 27,
      selectedPanels: 21,
      maxPanels: 45,
    });
    expect(model.blockers).toEqual(expect.arrayContaining([
      'Valid ID pending validation',
      'Site-control document pending validation',
      'Installer survey needed',
    ]));
    expect(model.steps.map((step) => step.id)).toEqual(goldenDemoStepIds);
  });

  it('runs the golden demo through document validation, survey validation, proposal, contract, and won handoff', () => {
    let state = createInitialSolarOpsState();
    const actions = createSolarOpsActions(() => state, (next) => { state = next; });
    actions.loadGoldenDemo();

    const messages: string[] = [];
    for (let index = 0; index < 6; index += 1) {
      const result = actions.runGoldenDemoNextStep();
      messages.push(result.message ?? result.error ?? '');
    }

    const model = buildGoldenDemoModel(state);

    expect(messages).toEqual(expect.arrayContaining([
      'Golden demo documents validated.',
      'Golden demo installer survey validated.',
      'Golden demo proposal generated and frozen.',
      'Golden demo contract link generated.',
      'Golden demo contract accepted.',
      'Golden demo marked won.',
    ]));
    expect(model.currentStepId).toBe('won');
    expect(model.progressPercent).toBe(100);
    expect(model.nextAction).toBe('Review release docs');
    expect(model.blockers).toEqual([]);
    expect(state.deals.find((deal) => deal.id === 'deal-demo-golden-msme')?.stage).toBe('won');
    expect(state.proposals.find((proposal) => proposal.dealId === 'deal-demo-golden-msme')?.status).toBe('accepted');
    expect(state.timelineEvents.some((event) => event.title === 'Golden demo completed')).toBe(true);
  });
});
