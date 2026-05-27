# Solar Inquiry-to-Installation Pipeline — MVP Build Spec

## Product name

**Solar Inquiry-to-Installation Pipeline**

Internal asset code: **REV-SB-001**

## Buyer

Solar installation companies serving MSMEs and commercial buyers.

## Business problem

Solar companies get inquiries from Facebook, Messenger, referrals, landing pages, QR kiosks, and phone calls. Those inquiries are often handled manually. Leads are not consistently qualified, site surveys are not always prepared, proposal follow-up is inconsistent, and permit/financing handoffs are scattered.

## MVP purpose

Prove that a solar company can move one MSME lead through a controlled path:

1. Inquiry captured
2. Pre-audit generated
3. Financing / fit score assigned
4. Site survey booked
5. Survey validation recorded
6. Proposal generated
7. LOI accepted
8. Ops and financing tasks triggered
9. Funnel leak visible

## MVP modules

### 1. Lead & Inquiry Capture

Inputs:

- Lead source
- Business name
- Decision maker
- Location
- Business type
- Monthly electricity bill
- Tariff assumption
- Production assumption
- Price-per-kWp assumption
- Property control
- Years in business
- Revenue band
- Bill payment behavior
- Purchase timeline
- Interest level
- Preferred survey slot
- Staff notes

MVP behavior:

- Standardizes multiple channels into one lead record.
- Separates priority leads from nurture leads.

Production version:

- FB Lead Ads → CRM
- Messenger → CRM
- Landing page → CRM
- QR form → CRM
- Phone call logged by admin
- Source attribution retained through proposal and sale

### 2. MSME Energy Audit & Sizing Engine

MVP math:

- Estimated monthly kWh = monthly bill / tariff
- Target offset = 50–65% depending on bill size
- Suggested kWp = monthly kWh × target offset / kWh-per-kWp-per-month
- Production estimate = kWp × kWh-per-kWp-per-month
- Savings proxy = min(monthly bill × 75%, production × tariff × 85%)
- Capex estimate = kWp × price-per-kWp assumption
- Payback = capex / monthly savings / 12

MVP boundary:

This is a pre-audit estimate only. Final engineering still requires site validation, roof assessment, component selection, shading analysis, DU requirements, and installer-specific pricing.

### 3. Financing & Scoring Module

Score inputs:

- Bill strength
- Property control
- Years in business
- Payment behavior
- Revenue band
- Timeline urgency
- Business type fit
- Interest signal

Score lanes:

- 80–100: Partner bank / co-op financing
- 60–79: In-house rent-to-own
- Below 60: Starter system, energy-efficiency first, or nurture

Offer cards:

- Cash
- Rent-to-own
- Partner loan

MVP boundary:

This does not replace bank underwriting. It gives sales an initial routing rule and prepares a cleaner financing packet.

### 4. Appointment + On-Site Validation

MVP behavior:

- Auto-books a survey slot after qualification.
- Generates a pre-visit summary.
- Lists required documents.
- Provides a lightweight survey app simulation.

Survey fields:

- Roof condition
- Shading level
- Usable roof area
- Photo placeholders

Production version:

- Calendar integration
- SMS/email reminders
- Mobile form
- Geotagged photos
- Installer rep assignment
- Survey completion trigger

### 5. Proposal, Metering & Workflow

MVP behavior:

- Generates proposal preview.
- Pulls client profile, source, estimated system size, savings, financing options, and survey validation.
- Includes net-metering / permits note.
- Simulates typed LOI acceptance.
- Triggers task cards for ops, sales, financing, and handoff routing.

Production version:

- Branded PDF or web proposal
- E-signature integration
- Proposal follow-up automations
- Ops checklist
- Financing package export
- Document management

### 6. Analytics & Optimization

MVP metrics:

- Inquiry count
- Qualified count
- Survey booked
- Proposal sent
- Signed

Production metrics:

- Time from inquiry to pre-audit
- Time from pre-audit to site survey
- Time from survey to proposal
- Proposal follow-up age
- Drop-off by lead source
- Drop-off by financing lane
- Average system size by business type
- Close rate by salesperson

## Suggested production stack

### Fast no-code stack

- CRM: GoHighLevel or Airtable
- Forms: GHL forms, Tally, Fillout, or Typeform
- Automation: Make or Zapier
- Calendar: GHL calendar or Google Calendar
- Proposal: PandaDoc, Better Proposals, DocuSign, or a simple web proposal
- Dashboard: Airtable Interface, Looker Studio, or GHL reporting

### Lean technical stack

- Frontend: Next.js
- Database: Supabase
- Automation: Supabase Edge Functions / Make
- Proposal: HTML to PDF service
- File storage: Supabase Storage
- E-sign: third-party signing provider

## MVP selling message

**I help solar companies turn messy Facebook and Messenger inquiries into qualified site surveys, tracked proposals, and permit-ready installation files.**

## First paid offer

**Solar Inquiry Leak Audit**

Scope:

- Review Facebook and Messenger inquiry process
- Map current lead stages
- Identify where follow-up breaks
- Identify what qualification data is missing
- Recommend the smallest pipeline build that fixes the highest-value leak

Suggested price:

- Free or low-cost diagnostic for first 1–3 prospects
- ₱5k–₱15k once you have proof

## First implementation offer

**Solar Sales Pipeline Starter System**

Scope:

- CRM pipeline
- Lead intake form
- Qualification fields
- Pre-audit estimate template
- Survey booking flow
- Proposal follow-up stages
- Basic dashboard
- Sales/admin walkthrough

Suggested price:

- ₱25k–₱50k setup
- ₱10k–₱25k/month optimization and QA

## V2 backlog

- Real Facebook comment-to-lead automation
- Messenger bot qualification
- SMS reminders
- Geotagged photo upload
- PDF proposal generation
- E-sign integration
- Installer rep assignment logic
- DU-specific permit checklist templates
- Financing partner portal
- Lost lead reactivation campaign
- Source-to-sale dashboard
