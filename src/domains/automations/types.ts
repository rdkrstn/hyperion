export type AutomationRecipeId =
  | 'lead_captured'
  | 'documents_missing'
  | 'proposal_sent'
  | 'survey_validated'
  | 'net_metering_blocked'
  | 'contract_ready';

export interface AutomationRecipe {
  id: AutomationRecipeId;
  title: string;
  trigger: string;
  action: string;
  sourceModule: string;
  envVar: string;
  defaultMode: 'local_simulation';
}

export interface AutomationEvent {
  id: string;
  recipeId: AutomationRecipeId;
  eventName: string;
  sourceModule: string;
  accountName: string;
  mode: 'local_simulation' | 'webhook';
  status: 'simulated' | 'sent' | 'failed';
  createdAt: string;
  target?: string;
}
