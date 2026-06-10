import type { AutomationEvent, AutomationRecipe, AutomationRecipeId } from '../types';

export const automationRecipes: AutomationRecipe[] = [
  {
    id: 'lead_captured',
    title: 'New lead captured',
    trigger: 'Lead created from inquiry or D2D intake',
    action: 'Create CRM task or send Slack notification',
    sourceModule: 'Pipeline',
    envVar: 'VITE_N8N_WEBHOOK_LEAD_CAPTURED',
    defaultMode: 'local_simulation',
  },
  {
    id: 'documents_missing',
    title: 'Documents missing',
    trigger: 'Proposal gate detects missing or pending documents',
    action: 'Send client reminder or create CS task',
    sourceModule: 'Workbench',
    envVar: 'VITE_N8N_WEBHOOK_DOCUMENTS_MISSING',
    defaultMode: 'local_simulation',
  },
  {
    id: 'proposal_sent',
    title: 'Proposal sent',
    trigger: 'Frozen proposal or contract link is generated',
    action: 'Schedule 3-day follow-up',
    sourceModule: 'Proposals',
    envVar: 'VITE_N8N_WEBHOOK_PROPOSAL_SENT',
    defaultMode: 'local_simulation',
  },
  {
    id: 'survey_validated',
    title: 'Survey validated',
    trigger: 'Installer validates site evidence',
    action: 'Notify proposal owner',
    sourceModule: 'Surveys',
    envVar: 'VITE_N8N_WEBHOOK_SURVEY_VALIDATED',
    defaultMode: 'local_simulation',
  },
  {
    id: 'net_metering_blocked',
    title: 'Net-metering blocked',
    trigger: 'Net-metering workflow has unresolved blockers',
    action: 'Create operations task',
    sourceModule: 'Net-metering',
    envVar: 'VITE_N8N_WEBHOOK_NET_METERING_BLOCKED',
    defaultMode: 'local_simulation',
  },
  {
    id: 'contract_ready',
    title: 'Contract ready',
    trigger: 'Proposal clears readiness gates',
    action: 'Notify installer or project coordinator',
    sourceModule: 'Contracts',
    envVar: 'VITE_N8N_WEBHOOK_CONTRACT_READY',
    defaultMode: 'local_simulation',
  },
];

const eventNames: Record<AutomationRecipeId, string> = {
  lead_captured: 'Lead capture task created',
  documents_missing: 'Document reminder prepared',
  proposal_sent: 'Proposal follow-up scheduled',
  survey_validated: 'Proposal owner notified',
  net_metering_blocked: 'Net-metering blocker task created',
  contract_ready: 'Contract-ready handoff sent',
};

function eventId(recipeId: AutomationRecipeId, index = 0) {
  return `automation-${recipeId}-${index + 1}`;
}

export function buildDemoAutomationEvents(accountName = 'Iloilo Mini Mart'): AutomationEvent[] {
  const baseDate = Date.UTC(2026, 5, 10, 8, 0, 0);
  return automationRecipes.map((recipe, index) => ({
    id: eventId(recipe.id, index),
    recipeId: recipe.id,
    eventName: eventNames[recipe.id],
    sourceModule: recipe.sourceModule,
    accountName,
    mode: 'local_simulation',
    status: 'simulated',
    createdAt: new Date(baseDate + index * 12 * 60 * 1000).toISOString(),
    target: recipe.envVar,
  }));
}

export async function simulateAutomationEvent(input: {
  recipeId: AutomationRecipeId;
  accountName: string;
  automationMode?: string;
  env?: Record<string, string | undefined>;
  fetcher?: typeof fetch;
}): Promise<AutomationEvent> {
  const recipe = automationRecipes.find((item) => item.id === input.recipeId);
  if (!recipe) throw new Error(`Unknown automation recipe: ${input.recipeId}`);
  const webhookUrl = input.env?.[recipe.envVar];
  const explicitWebhookMode = input.automationMode === 'webhook' && Boolean(webhookUrl);
  const event: AutomationEvent = {
    id: `automation-${recipe.id}-${Date.now()}`,
    recipeId: recipe.id,
    eventName: eventNames[recipe.id],
    sourceModule: recipe.sourceModule,
    accountName: input.accountName,
    mode: explicitWebhookMode ? 'webhook' : 'local_simulation',
    status: explicitWebhookMode ? 'sent' : 'simulated',
    createdAt: new Date().toISOString(),
    target: explicitWebhookMode ? webhookUrl : recipe.envVar,
  };

  if (explicitWebhookMode) {
    const fetcher = input.fetcher ?? fetch;
    const response = await fetcher(webhookUrl!, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
    });
    return response.ok ? event : { ...event, status: 'failed' };
  }

  return event;
}
