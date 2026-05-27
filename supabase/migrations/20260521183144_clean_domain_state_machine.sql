create schema if not exists private;

create type public.app_role as enum ('owner', 'manager', 'sales', 'cs', 'installer');
create type public.lead_status as enum ('captured', 'qualified', 'deal_created', 'archived');
create type public.deal_stage as enum ('deal_created', 'solar_snapshot_reviewed', 'survey_scheduled', 'survey_validated', 'proposal_built', 'client_portal_shared', 'contract_accepted', 'won');
create type public.deal_status as enum ('open', 'won', 'lost', 'cancelled', 'archived');
create type public.document_status as enum ('missing', 'uploaded', 'needs_review', 'validated', 'rejected', 'expired');
create type public.solar_dispatch_gate as enum ('ready', 'blocked', 'manual_override_required', 'override_approved');
create type public.survey_validation_status as enum ('scheduled', 'evidence_pending', 'blocked', 'validated');
create type public.proposal_status as enum ('draft', 'frozen', 'shared', 'accepted', 'rejected');
create type public.document_category as enum (
  'customer_bill',
  'valid_id',
  'site_control_document',
  'business_docs',
  'survey_evidence',
  'compliance_template',
  'generated_compliance_pdf',
  'proposal_snapshot',
  'contract',
  'invoice',
  'receipt_reference'
);

create table public.staff_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete cascade,
  full_name text not null,
  email text,
  phone text,
  role public.app_role not null default 'sales',
  active boolean not null default true,
  preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function private.current_app_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.staff_profiles where user_id = auth.uid() and active = true limit 1
$$;

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  status public.lead_status not null default 'captured',
  business_name text not null,
  contact_name text not null,
  phone text,
  email text,
  source text not null,
  customer_type text not null default 'commercial',
  assigned_sales uuid references public.staff_profiles(id),
  goal text not null,
  payment_preference text not null default 'loan',
  readiness_score integer not null default 0 check (readiness_score between 0 and 100),
  qualification_status text not null default 'new_inquiry',
  missing_blockers text[] not null default '{}',
  next_best_action text not null default 'Complete qualification.',
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.lead_energy_profiles (
  lead_id uuid primary key references public.leads(id) on delete cascade,
  monthly_bill numeric not null default 0,
  monthly_kwh numeric,
  billing_period text,
  utility_provider_from_bill text,
  ocr_confidence numeric,
  bill_history jsonb not null default '[]'::jsonb,
  annualized_monthly_bill numeric,
  annualized_monthly_kwh numeric,
  bill_history_months integer not null default 0,
  bill_history_annualized boolean not null default false,
  daytime_usage text not null default 'unknown',
  operating_hours text not null default 'not_captured',
  brownout_concern boolean not null default false,
  battery_interest boolean not null default false,
  updated_at timestamptz not null default now()
);

create table public.lead_site_profiles (
  lead_id uuid primary key references public.leads(id) on delete cascade,
  address text not null,
  formatted_address text,
  place_id text,
  latitude numeric,
  longitude numeric,
  utility_provider text,
  site_control text not null default 'unknown',
  property_type text not null default 'commercial',
  maps_status text not null default 'pending',
  updated_at timestamptz not null default now()
);

create table public.qualification_sections (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  section_key text not null,
  label text not null,
  state text not null default 'missing',
  required boolean not null default false,
  missing_items text[] not null default '{}',
  updated_at timestamptz not null default now(),
  unique (lead_id, section_key)
);

create table public.bill_uploads (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  document_id uuid,
  storage_path text not null,
  file_name text not null,
  status text not null default 'uploaded',
  ocr_provider text not null default 'google_vision',
  bill_amount numeric,
  kwh numeric,
  billing_period text,
  account_name text,
  utility_provider text,
  confidence numeric,
  gemini_confidence numeric,
  needs_manual_review boolean not null default false,
  monthly_series jsonb not null default '[]'::jsonb,
  annualized boolean not null default false,
  source_month_count integer not null default 0,
  raw_text text,
  created_at timestamptz not null default now()
);

create table public.solar_snapshots (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  deal_id uuid,
  latitude numeric not null,
  longitude numeric not null,
  roof_capacity_kwp numeric not null default 0,
  max_panels integer not null default 0,
  panel_capacity_watts integer not null default 580,
  selected_panel_count integer not null default 0,
  selected_system_size_kwp numeric not null default 0,
  annual_production_kwh numeric not null default 0,
  max_annual_production_kwh numeric not null default 0,
  imagery_quality text not null default 'unknown',
  roof_area_m2 numeric not null default 0,
  sunshine_hours_per_year numeric not null default 0,
  carbon_offset_factor_kg_per_mwh numeric not null default 0,
  imagery_date jsonb not null default '{}'::jsonb,
  imagery_processed_date jsonb not null default '{}'::jsonb,
  bounding_box jsonb not null default '{}'::jsonb,
  building_center jsonb not null default '{}'::jsonb,
  roof_segments jsonb not null default '[]'::jsonb,
  panel_placements jsonb not null default '[]'::jsonb,
  data_layer_state jsonb not null default '{"status":"not_requested"}'::jsonb,
  pitch numeric,
  azimuth numeric,
  risk_flags text[] not null default '{}',
  dispatch_gate public.solar_dispatch_gate not null default 'blocked',
  recommended_next_action text not null default 'Review Solar API result.',
  raw_payload jsonb not null default '{}'::jsonb,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.deals (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete restrict,
  name text not null,
  value numeric not null default 0,
  stage public.deal_stage not null default 'deal_created',
  status public.deal_status not null default 'open',
  source text not null,
  sales_owner uuid references public.staff_profiles(id),
  expected_close_date date,
  survey_status public.survey_validation_status not null default 'scheduled',
  proposal_status public.proposal_status not null default 'draft',
  portal_status text not null default 'not_shared',
  document_status public.document_status not null default 'missing',
  contract_status text not null default 'not_started',
  next_best_action text not null default 'Run Solar Snapshot.',
  blocker text,
  lead_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.solar_snapshots
  add constraint solar_snapshots_deal_id_fkey foreign key (deal_id) references public.deals(id) on delete set null;

create table public.deal_commercial_packets (
  deal_id uuid primary key references public.deals(id) on delete cascade,
  proposed_system_size_kwp numeric not null default 0,
  estimated_price numeric not null default 0,
  gross_margin_percent numeric not null default 0,
  payment_option text not null default 'cash',
  financing_readiness jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads(id) on delete cascade,
  deal_id uuid references public.deals(id) on delete cascade,
  survey_id uuid,
  proposal_id uuid,
  client_id uuid,
  category public.document_category not null,
  file_name text not null,
  mime_type text not null,
  bucket text not null default 'deal-files',
  storage_path text not null,
  status public.document_status not null default 'needs_review',
  uploaded_by uuid references public.staff_profiles(id),
  validated_by uuid references public.staff_profiles(id),
  reviewer_notes text,
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (bucket, storage_path)
);

create table public.remote_intake_tokens (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  deal_id uuid references public.deals(id) on delete cascade,
  token text not null unique,
  access_jwt text not null,
  status text not null default 'generated',
  allowed_categories public.document_category[] not null default array['customer_bill','valid_id','site_control_document']::public.document_category[],
  expires_at timestamptz not null,
  created_by uuid references public.staff_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.surveys (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  deal_id uuid not null references public.deals(id) on delete cascade,
  installer_id uuid not null references public.staff_profiles(id),
  scheduled_at timestamptz not null,
  location text not null,
  access_instructions text,
  solar_snapshot_id uuid references public.solar_snapshots(id) on delete set null,
  validation_status public.survey_validation_status not null default 'scheduled',
  is_structurally_sound boolean,
  findings jsonb not null default '{}'::jsonb,
  blockers text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.documents
  add constraint documents_survey_id_fkey foreign key (survey_id) references public.surveys(id) on delete cascade;

create table public.survey_evidence (
  id uuid primary key default gen_random_uuid(),
  survey_id uuid not null references public.surveys(id) on delete cascade,
  category text not null,
  file_name text not null,
  mime_type text not null,
  bucket text not null default 'survey-evidence',
  storage_path text not null,
  preview_url text,
  uploaded_by uuid references public.staff_profiles(id),
  uploaded_at timestamptz not null default now(),
  unique (survey_id, category)
);

create table public.proposals (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals(id) on delete cascade,
  revision integer not null default 1,
  status public.proposal_status not null default 'draft',
  system_size_kwp numeric not null,
  subtotal numeric not null default 0,
  estimated_cost numeric not null default 0,
  gross_margin_percent numeric not null default 0,
  payment_option text not null default 'cash',
  contract_token text unique,
  public_url text,
  frozen_snapshot jsonb not null default '{}'::jsonb,
  frozen_at timestamptz,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.documents
  add constraint documents_proposal_id_fkey foreign key (proposal_id) references public.proposals(id) on delete cascade;

create table public.quote_line_items (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.proposals(id) on delete cascade,
  category text not null,
  name text not null,
  quantity numeric not null default 1,
  unit text not null default 'lot',
  unit_price numeric not null default 0,
  estimated_cost numeric not null default 0,
  margin_percent numeric not null default 0,
  total numeric not null default 0,
  source_reason text not null,
  notes text,
  optional boolean not null default false,
  manually_edited boolean not null default false
);

create table public.billing_invoices (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals(id) on delete cascade,
  proposal_id uuid not null references public.proposals(id) on delete restrict,
  amount numeric not null,
  status text not null default 'issued',
  provider_execution text not null default 'mocked',
  created_at timestamptz not null default now()
);

create table public.contract_acceptances (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.proposals(id) on delete cascade,
  signer_name text not null,
  token text not null,
  accepted_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create table public.client_portals (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals(id) on delete cascade,
  token text not null unique,
  public_url text not null,
  status text not null default 'active',
  last_viewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid unique references public.deals(id) on delete restrict,
  business_name text not null,
  contact_name text not null,
  location text not null,
  status text not null default 'active_client',
  created_at timestamptz not null default now()
);

alter table public.documents
  add constraint documents_client_id_fkey foreign key (client_id) references public.clients(id) on delete cascade;

create table public.financing_packets (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads(id) on delete cascade,
  deal_id uuid references public.deals(id) on delete cascade,
  status text not null default 'draft',
  packet jsonb not null default '{}'::jsonb,
  risk_flags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.compliance_rules (
  id uuid primary key default gen_random_uuid(),
  version text not null unique,
  active boolean not null default false,
  source_notes text not null default '',
  electrical_permit_working_days integer not null default 3,
  cfei_working_days integer not null default 7,
  effective_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table public.compliance_holidays (
  day date primary key,
  label text not null
);

create table public.net_metering_workflows (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null unique references public.leads(id) on delete cascade,
  deal_id uuid references public.deals(id) on delete cascade,
  status text not null default 'draft',
  electrical_permit_submitted_at timestamptz,
  cfei_submitted_at timestamptz,
  ready_for_lender_at timestamptz,
  owner_ready_override_at timestamptz,
  owner_ready_override_reason text,
  rule_version text references public.compliance_rules(version),
  updated_at timestamptz not null default now()
);

create table public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  linked_deal_id uuid references public.deals(id) on delete cascade,
  linked_survey_id uuid references public.surveys(id) on delete cascade,
  title text not null,
  start_at timestamptz not null,
  location text not null,
  created_at timestamptz not null default now()
);

create table public.tickets (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null,
  status text not null default 'open',
  priority text not null default 'medium',
  linked_lead_id uuid references public.leads(id) on delete set null,
  linked_deal_id uuid references public.deals(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.timeline_events (
  id uuid primary key default gen_random_uuid(),
  owner_type text not null,
  owner_id uuid not null,
  lead_id uuid references public.leads(id) on delete cascade,
  deal_id uuid references public.deals(id) on delete cascade,
  survey_id uuid references public.surveys(id) on delete cascade,
  document_id uuid references public.documents(id) on delete cascade,
  proposal_id uuid references public.proposals(id) on delete cascade,
  title text not null,
  description text not null default '',
  actor_role text not null default 'system',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  target_profile_id uuid references public.staff_profiles(id) on delete cascade,
  target_role public.app_role,
  title text not null,
  body text not null,
  linked_record_type text,
  linked_record_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index leads_status_idx on public.leads(status);
create index documents_owner_idx on public.documents(lead_id, deal_id, survey_id, proposal_id, client_id);
create index deals_lead_id_idx on public.deals(lead_id);
create index solar_snapshots_lead_deal_idx on public.solar_snapshots(lead_id, deal_id);
create index surveys_deal_idx on public.surveys(deal_id);
create index timeline_owner_idx on public.timeline_events(owner_type, owner_id, created_at desc);

alter table public.staff_profiles enable row level security;
alter table public.leads enable row level security;
alter table public.lead_energy_profiles enable row level security;
alter table public.lead_site_profiles enable row level security;
alter table public.qualification_sections enable row level security;
alter table public.bill_uploads enable row level security;
alter table public.solar_snapshots enable row level security;
alter table public.deals enable row level security;
alter table public.deal_commercial_packets enable row level security;
alter table public.documents enable row level security;
alter table public.remote_intake_tokens enable row level security;
alter table public.surveys enable row level security;
alter table public.survey_evidence enable row level security;
alter table public.proposals enable row level security;
alter table public.quote_line_items enable row level security;
alter table public.billing_invoices enable row level security;
alter table public.contract_acceptances enable row level security;
alter table public.client_portals enable row level security;
alter table public.clients enable row level security;
alter table public.financing_packets enable row level security;
alter table public.compliance_rules enable row level security;
alter table public.compliance_holidays enable row level security;
alter table public.net_metering_workflows enable row level security;
alter table public.calendar_events enable row level security;
alter table public.tickets enable row level security;
alter table public.timeline_events enable row level security;
alter table public.notifications enable row level security;

create policy staff_profiles_read_self_owner on public.staff_profiles for select to authenticated
using (user_id = auth.uid() or private.current_app_role() in ('owner', 'manager'));
create policy staff_profiles_owner_manage on public.staff_profiles for all to authenticated
using (private.current_app_role() = 'owner')
with check (private.current_app_role() = 'owner');

create policy staff_read_all on public.leads for select to authenticated using (private.current_app_role() in ('owner', 'manager', 'sales', 'cs', 'installer'));
create policy sales_manage_leads on public.leads for all to authenticated using (private.current_app_role() in ('owner', 'manager', 'sales')) with check (private.current_app_role() in ('owner', 'manager', 'sales'));

create policy staff_read_energy on public.lead_energy_profiles for select to authenticated using (private.current_app_role() in ('owner', 'manager', 'sales', 'cs', 'installer'));
create policy server_staff_manage_energy on public.lead_energy_profiles for all to authenticated using (private.current_app_role() in ('owner', 'manager', 'sales')) with check (private.current_app_role() in ('owner', 'manager', 'sales'));
create policy staff_read_site on public.lead_site_profiles for select to authenticated using (private.current_app_role() in ('owner', 'manager', 'sales', 'cs', 'installer'));
create policy server_staff_manage_site on public.lead_site_profiles for all to authenticated using (private.current_app_role() in ('owner', 'manager', 'sales')) with check (private.current_app_role() in ('owner', 'manager', 'sales'));
create policy staff_read_qualification on public.qualification_sections for select to authenticated using (private.current_app_role() in ('owner', 'manager', 'sales', 'cs'));
create policy sales_manage_qualification on public.qualification_sections for all to authenticated using (private.current_app_role() in ('owner', 'manager', 'sales')) with check (private.current_app_role() in ('owner', 'manager', 'sales'));
create policy staff_read_bill_uploads on public.bill_uploads for select to authenticated using (private.current_app_role() in ('owner', 'manager', 'sales', 'cs'));
create policy sales_insert_bill_uploads on public.bill_uploads for insert to authenticated with check (private.current_app_role() in ('owner', 'manager', 'sales'));

create policy staff_read_deals on public.deals for select to authenticated using (private.current_app_role() in ('owner', 'manager', 'sales', 'cs', 'installer'));
create policy sales_manage_deals on public.deals for all to authenticated using (private.current_app_role() in ('owner', 'manager', 'sales')) with check (private.current_app_role() in ('owner', 'manager', 'sales'));
create policy staff_read_commercial_packets on public.deal_commercial_packets for select to authenticated using (private.current_app_role() in ('owner', 'manager', 'sales', 'cs'));
create policy sales_manage_commercial_packets on public.deal_commercial_packets for all to authenticated using (private.current_app_role() in ('owner', 'manager', 'sales')) with check (private.current_app_role() in ('owner', 'manager', 'sales'));
create policy staff_read_solar_snapshots on public.solar_snapshots for select to authenticated using (private.current_app_role() in ('owner', 'manager', 'sales', 'cs', 'installer'));
create policy sales_manage_solar_snapshots on public.solar_snapshots for all to authenticated using (private.current_app_role() in ('owner', 'manager', 'sales')) with check (private.current_app_role() in ('owner', 'manager', 'sales'));

create policy staff_read_documents on public.documents for select to authenticated using (private.current_app_role() in ('owner', 'manager', 'sales', 'cs', 'installer'));
create policy staff_upload_documents on public.documents for insert to authenticated with check (private.current_app_role() in ('owner', 'manager', 'sales', 'cs', 'installer'));
create policy cs_owner_validate_documents on public.documents for update to authenticated using (private.current_app_role() in ('owner', 'cs')) with check (private.current_app_role() in ('owner', 'cs'));

create policy staff_read_remote_tokens on public.remote_intake_tokens for select to authenticated using (private.current_app_role() in ('owner', 'manager', 'sales', 'cs'));
create policy sales_create_remote_tokens on public.remote_intake_tokens for all to authenticated using (private.current_app_role() in ('owner', 'sales', 'cs')) with check (private.current_app_role() in ('owner', 'sales', 'cs'));

create policy surveys_read_assigned_or_ops on public.surveys for select to authenticated
using (private.current_app_role() in ('owner', 'manager', 'sales') or (private.current_app_role() = 'installer' and installer_id in (select id from public.staff_profiles where user_id = auth.uid())));
create policy surveys_sales_insert on public.surveys for insert to authenticated with check (private.current_app_role() in ('owner', 'sales'));
create policy surveys_installer_update on public.surveys for update to authenticated
using (private.current_app_role() in ('owner', 'sales') or (private.current_app_role() = 'installer' and installer_id in (select id from public.staff_profiles where user_id = auth.uid())))
with check (private.current_app_role() in ('owner', 'sales') or (private.current_app_role() = 'installer' and installer_id in (select id from public.staff_profiles where user_id = auth.uid())));
create policy survey_evidence_read_staff on public.survey_evidence for select to authenticated using (private.current_app_role() in ('owner', 'manager', 'sales', 'installer'));
create policy survey_evidence_installer_insert on public.survey_evidence for insert to authenticated with check (private.current_app_role() in ('owner', 'installer'));

create policy proposal_read_staff on public.proposals for select to authenticated using (private.current_app_role() in ('owner', 'manager', 'sales', 'cs'));
create policy proposal_manage_revenue on public.proposals for all to authenticated using (private.current_app_role() in ('owner', 'manager', 'sales')) with check (private.current_app_role() in ('owner', 'manager', 'sales'));
create policy quote_line_items_read_staff on public.quote_line_items for select to authenticated using (private.current_app_role() in ('owner', 'manager', 'sales', 'cs'));
create policy quote_line_items_manage_revenue on public.quote_line_items for all to authenticated using (private.current_app_role() in ('owner', 'manager', 'sales')) with check (private.current_app_role() in ('owner', 'manager', 'sales'));
create policy billing_invoices_read_staff on public.billing_invoices for select to authenticated using (private.current_app_role() in ('owner', 'manager', 'sales', 'cs'));
create policy contract_acceptances_read_staff on public.contract_acceptances for select to authenticated using (private.current_app_role() in ('owner', 'manager', 'sales', 'cs'));
create policy portals_staff_read on public.client_portals for select to authenticated using (private.current_app_role() in ('owner', 'manager', 'sales', 'cs'));
create policy portals_sales_manage on public.client_portals for all to authenticated using (private.current_app_role() in ('owner', 'sales')) with check (private.current_app_role() in ('owner', 'sales'));
create policy clients_staff_read on public.clients for select to authenticated using (private.current_app_role() in ('owner', 'manager', 'sales', 'cs'));
create policy financing_packets_staff_read on public.financing_packets for select to authenticated using (private.current_app_role() in ('owner', 'manager', 'sales', 'cs'));
create policy compliance_rules_staff_read on public.compliance_rules for select to authenticated using (private.current_app_role() in ('owner', 'manager', 'sales', 'cs'));
create policy compliance_rules_owner_manage on public.compliance_rules for all to authenticated using (private.current_app_role() = 'owner') with check (private.current_app_role() = 'owner');
create policy compliance_holidays_staff_read on public.compliance_holidays for select to authenticated using (private.current_app_role() in ('owner', 'manager', 'sales', 'cs'));
create policy compliance_holidays_owner_manage on public.compliance_holidays for all to authenticated using (private.current_app_role() = 'owner') with check (private.current_app_role() = 'owner');
create policy net_metering_staff_read on public.net_metering_workflows for select to authenticated using (private.current_app_role() in ('owner', 'manager', 'sales', 'cs', 'installer'));
create policy net_metering_cs_owner_manage on public.net_metering_workflows for all to authenticated using (private.current_app_role() in ('owner', 'cs')) with check (private.current_app_role() in ('owner', 'cs'));
create policy calendar_staff_read on public.calendar_events for select to authenticated using (private.current_app_role() in ('owner', 'manager', 'sales', 'cs', 'installer'));
create policy calendar_sales_manage on public.calendar_events for all to authenticated using (private.current_app_role() in ('owner', 'manager', 'sales')) with check (private.current_app_role() in ('owner', 'manager', 'sales'));
create policy tickets_staff_read on public.tickets for select to authenticated using (private.current_app_role() in ('owner', 'manager', 'sales', 'cs'));
create policy tickets_staff_manage on public.tickets for all to authenticated using (private.current_app_role() in ('owner', 'manager', 'sales', 'cs')) with check (private.current_app_role() in ('owner', 'manager', 'sales', 'cs'));
create policy timeline_staff_read on public.timeline_events for select to authenticated using (private.current_app_role() in ('owner', 'manager', 'sales', 'cs', 'installer'));
create policy timeline_staff_insert on public.timeline_events for insert to authenticated with check (private.current_app_role() in ('owner', 'manager', 'sales', 'cs', 'installer'));
create policy notifications_read_target on public.notifications for select to authenticated using (private.current_app_role() in ('owner', 'manager') or target_profile_id in (select id from public.staff_profiles where user_id = auth.uid()) or target_role = private.current_app_role());
create policy notifications_staff_insert on public.notifications for insert to authenticated with check (private.current_app_role() in ('owner', 'manager', 'sales', 'cs', 'installer'));

insert into storage.buckets (id, name, public)
values
  ('readiness-uploads', 'readiness-uploads', false),
  ('survey-evidence', 'survey-evidence', false),
  ('deal-files', 'deal-files', false),
  ('compliance-doc-templates', 'compliance-doc-templates', false),
  ('compliance-documents', 'compliance-documents', false)
on conflict (id) do nothing;

insert into public.compliance_rules (version, active, source_notes)
values (
  'ph-net-metering-ra11032-v1',
  true,
  'Internal rule config for DOE net-metering and RA 11032 SLA tracking. Electrical permit deemed-approved after 3 working days; CFEI after 7 working days; actual government document status remains auditable.'
)
on conflict (version) do update set active = excluded.active, source_notes = excluded.source_notes;
