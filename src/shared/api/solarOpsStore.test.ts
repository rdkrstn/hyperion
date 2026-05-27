import { describe, expect, it } from 'vitest';
import { createInitialSolarOpsState, createSolarOpsActions } from './solarOpsStore';

describe('solar ops store', () => {
  it('loads the curated local demo leads with OCR, documents, solar snapshots, and blockers', () => {
    let state = createInitialSolarOpsState();
    const actions = createSolarOpsActions(() => state, (next) => { state = next; });

    const result = actions.loadDemoData();

    expect(result.ok).toBe(true);
    expect(state.leads.map((lead) => lead.businessName)).toEqual([
      'Iloilo Mini Mart',
      'Maria Santos',
      'Jaro Print & Packaging',
      'Atria Cold Storage',
      'Iloilo Montessori School',
      'Oton Water Refilling Station',
    ]);
    expect(state.leads.find((lead) => lead.id === 'lead-demo-golden-msme')).toMatchObject({
      readinessScore: 86,
      recommendedSystemRange: '10-15 kWp',
      estimatedSavingsRange: 'PHP 18,000-28,000 / month',
      nextAction: 'Schedule installer survey.',
    });
    expect(state.leads.find((lead) => lead.id === 'lead-demo-residential-blocked')).toMatchObject({
      readinessScore: 54,
      recommendedSystemRange: '2-3 kWp',
      nextAction: 'Confirm property authorization and payment preference.',
    });
    expect(state.leads.find((lead) => lead.id === 'lead-demo-commercial-doc-blocked')).toMatchObject({
      readinessScore: 74,
      recommendedSystemRange: '25-40 kWp',
      nextAction: 'Upload landlord/site authorization.',
    });
    expect(state.leads.find((lead) => lead.id === 'lead-demo-cold-storage')).toMatchObject({
      readinessScore: 91,
      recommendedSystemRange: '45-65 kWp',
      nextAction: 'Schedule installer survey for cold-storage validation.',
    });
    expect(state.leads.find((lead) => lead.id === 'lead-demo-school-continuity')).toMatchObject({
      readinessScore: 78,
      recommendedSystemRange: '12-20 kWp',
      nextAction: 'Validate board authorization and net-metering documents.',
    });
    expect(state.leads.find((lead) => lead.id === 'lead-demo-water-refilling-review')).toMatchObject({
      readinessScore: 66,
      recommendedSystemRange: '6-10 kWp',
      nextAction: 'Request owner/manager manual Solar Snapshot review.',
    });
    expect(state.documents.filter((document) => document.leadId === 'lead-demo-golden-msme')).toHaveLength(4);
    expect(state.documents.find((document) => document.id === 'doc-demo-golden-bill')).toMatchObject({
      category: 'customer_bill',
      validationStatus: 'validated',
    });
    expect(state.solarSnapshots.find((snapshot) => snapshot.id === 'solar-demo-golden-msme')).toMatchObject({
      roofCapacityKwp: 27,
      maxPanels: 45,
      imageryQuality: 'HIGH',
      status: 'ready',
    });
    expect(state.deals.find((deal) => deal.id === 'deal-demo-golden-msme')).toMatchObject({
      stage: 'solar_snapshot_reviewed',
      documentStatus: 'pending_validation',
      nextAction: 'Schedule installer survey.',
    });
  });

  it('creates a lead from a confirmed pin and immediately creates the local Solar Snapshot', () => {
    let state = createInitialSolarOpsState();
    const actions = createSolarOpsActions(() => state, (next) => { state = next; });

    const result = actions.createLead({
      businessName: 'Pinned Iloilo Shop',
      contactName: 'Nina Dela Cruz',
      phone: '09170001111',
      source: 'd2d',
      location: '',
      latitude: 10.7202,
      longitude: 122.5621,
      monthlyBill: 52000,
      goal: 'lower_bill',
      siteControl: 'owned',
      assignedSales: 'sales-1',
      daytimeUsage: 'high',
    });

    expect(result.ok).toBe(true);
    expect(result.message).toBe('Lead created and Solar Snapshot reviewed from pin.');
    expect(state.leads[0].siteProfile.location).toBe('Pinned location (10.720200, 122.562100)');
    expect(state.solarSnapshots[0].leadId).toBe(state.leads[0].id);
    expect(state.solarSnapshots[0].status).toBe('ready');
  });

  it('generates a 12-month energy graph from the captured bill estimate', () => {
    let state = createInitialSolarOpsState();
    const actions = createSolarOpsActions(() => state, (next) => { state = next; });

    const lead = actions.createLead({
      businessName: 'Graph Ready Store',
      contactName: 'Ana Cruz',
      phone: '09170004444',
      source: 'd2d',
      location: 'Iloilo City',
      monthlyBill: 36000,
      monthlyKwh: 2800,
      goal: 'lower_bill',
      siteControl: 'owned',
      assignedSales: 'sales-1',
      daytimeUsage: 'high',
    }).data!;

    const result = actions.generateEnergyGraph(lead.id);

    expect(result.ok).toBe(true);
    expect(state.leads[0].energyProfile.billHistory).toHaveLength(12);
    expect(state.leads[0].energyProfile.billHistoryAnnualized).toBe(true);
    expect(state.leads[0].billUploads[0]).toMatchObject({
      status: 'ocr_completed',
      ocrProvider: 'manual',
      sourceMonthCount: 6,
    });
  });

  it('runs local fixture bill OCR from an uploaded customer bill and updates the Energy Profile graph', () => {
    let state = createInitialSolarOpsState();
    const actions = createSolarOpsActions(() => state, (next) => { state = next; });

    const lead = actions.createLead({
      businessName: 'OCR Store',
      contactName: 'Nina Santos',
      phone: '09170008888',
      source: 'd2d',
      location: 'Iloilo City',
      monthlyBill: 5000,
      goal: 'lower_bill',
      siteControl: 'owned',
      assignedSales: 'sales-1',
      daytimeUsage: 'medium',
    }).data!;
    const document = actions.uploadDocument({
      leadId: lead.id,
      category: 'customer_bill',
      fileName: 'FB_IMG_1779374132169.jpg',
      mimeType: 'image/jpeg',
      storagePath: `${lead.id}/customer_bill/FB_IMG_1779374132169.jpg`,
      uploadedBy: 'sales-1',
      fileDataUrl: 'data:image/jpeg;base64,fixture',
    }).data!;

    const result = actions.runBillOcrForDocument(document.id);

    expect(result.ok).toBe(true);
    expect(state.leads[0].billUploads[0]).toMatchObject({
      documentId: document.id,
      provider: 'Meralco',
      ocrProvider: 'manual',
      sourceMonthCount: 1,
      annualized: true,
    });
    expect(state.leads[0].energyProfile.billHistory).toHaveLength(12);
    expect(state.timelineEvents[0].title).toBe('Energy graph generated');
  });

  it('updates qualification answers so a captured lead can clear site-control blockers', () => {
    let state = createInitialSolarOpsState();
    const actions = createSolarOpsActions(() => state, (next) => { state = next; });

    const lead = actions.createLead({
      businessName: 'Needs Site Control',
      contactName: 'Liza Cruz',
      phone: '09170005555',
      source: 'd2d',
      location: 'Iloilo City',
      monthlyBill: 42000,
      goal: 'lower_bill',
      siteControl: 'unknown',
      assignedSales: 'sales-1',
      daytimeUsage: 'medium',
    }).data!;

    expect(state.leads[0].missingBlockers).toContain('site-control answer');

    const updated = actions.updateLeadQualification(lead.id, {
      siteControl: 'owned',
      customerType: 'commercial',
      daytimeUsage: 'high',
    });

    expect(updated.ok).toBe(true);
    expect(state.leads[0].siteProfile.siteControl).toBe('owned');
    expect(state.leads[0].missingBlockers).not.toContain('site-control answer');
    expect(state.leads[0].qualificationSections.find((section) => section.id === 'site_control')?.state).toBe('complete');
  });

  it('uses validated linked documents and Solar Snapshot panel allocation when creating proposal', () => {
    let state = createInitialSolarOpsState();
    const actions = createSolarOpsActions(() => state, (next) => { state = next; });

    const lead = actions.createLead({
      businessName: 'Validated Docs Store',
      contactName: 'Ben Reyes',
      phone: '09170002222',
      source: 'd2d',
      location: '',
      latitude: 10.816663,
      longitude: 122.542422,
      utilityProvider: 'Meralco',
      monthlyBill: 52000,
      goal: 'lower_bill',
      siteControl: 'owned',
      assignedSales: 'sales-1',
      daytimeUsage: 'high',
    }).data!;

    actions.qualifyLead(lead.id);
    const deal = actions.createDealFromLead(lead.id, { name: 'Validated Docs rooftop', salesOwner: 'sales-1' }).data!;
    const solar = state.solarSnapshots.find((snapshot) => snapshot.dealId === deal.id)!;
    actions.updateSolarPanelLayout(solar.id, { panelCount: 13, panelCapacityWatts: 580 });
    const survey = actions.scheduleSurvey(deal.id, { installerId: 'installer-1', scheduledAt: '2026-05-25T09:00', location: deal.leadSnapshot.location }).data!;
    for (const category of ['main_breaker_panel', 'roof_surface', 'inverter_location', 'wire_run_path'] as const) {
      actions.uploadSurveyEvidence(survey.id, { category, fileName: `${category}.jpg`, mimeType: 'image/jpeg', storagePath: `${survey.id}/${category}.jpg` });
    }
    actions.setSurveyStructuralSoundness(survey.id, true);
    actions.validateSurvey(survey.id);

    for (const category of ['customer_bill', 'valid_id', 'site_control_document'] as const) {
      const document = actions.uploadDocument({ leadId: lead.id, dealId: deal.id, category, fileName: `${category}.pdf`, mimeType: 'application/pdf', storagePath: `${lead.id}/${category}.pdf`, uploadedBy: 'sales-1' }).data!;
      actions.validateDocument(document.id, 'cs-1');
    }
    state = { ...state, deals: state.deals.map((item) => item.id === deal.id ? { ...item, documentStatus: 'missing' } : item) };

    const proposal = actions.createProposal(deal.id, { systemSizeKwp: 99 }).data!;

    expect(proposal.solarSnapshotSummary?.selectedPanelCount).toBe(13);
    expect(proposal.scopeLines.find((line) => line.category === 'panels')?.quantity).toBe(13);
    expect(state.deals.find((item) => item.id === deal.id)?.documentStatus).toBe('validated');
  });

  it('keeps only the latest panel layout timeline event for repeated slider changes', () => {
    let state = createInitialSolarOpsState();
    const actions = createSolarOpsActions(() => state, (next) => { state = next; });

    const lead = actions.createLead({
      businessName: 'Timeline Clean Store',
      contactName: 'Mila Reyes',
      phone: '09170006666',
      source: 'd2d',
      location: '',
      latitude: 10.816663,
      longitude: 122.542422,
      utilityProvider: 'Meralco',
      monthlyBill: 52000,
      goal: 'lower_bill',
      siteControl: 'owned',
      assignedSales: 'sales-1',
      daytimeUsage: 'high',
    }).data!;
    const solar = state.solarSnapshots.find((snapshot) => snapshot.leadId === lead.id)!;

    actions.updateSolarPanelLayout(solar.id, { panelCount: 6 });
    actions.updateSolarPanelLayout(solar.id, { panelCount: 7 });
    actions.updateSolarPanelLayout(solar.id, { panelCount: 8 });

    const panelEvents = state.timelineEvents.filter((event) => event.ownerId === lead.id && event.title === 'Solar panel layout updated');
    expect(panelEvents).toHaveLength(1);
    expect(panelEvents[0].description).toContain('8 panels');
  });

  it('allows proposal creation when required documents are validated at lead level only', () => {
    let state = createInitialSolarOpsState();
    const actions = createSolarOpsActions(() => state, (next) => { state = next; });

    const lead = actions.createLead({
      businessName: 'Lead Level Docs Store',
      contactName: 'Carlo Reyes',
      phone: '09170003333',
      source: 'd2d',
      location: '',
      latitude: 10.816663,
      longitude: 122.542422,
      utilityProvider: 'Meralco',
      monthlyBill: 52000,
      goal: 'lower_bill',
      siteControl: 'owned',
      assignedSales: 'sales-1',
      daytimeUsage: 'high',
    }).data!;
    actions.qualifyLead(lead.id);
    const deal = actions.createDealFromLead(lead.id, { name: 'Lead docs rooftop', salesOwner: 'sales-1' }).data!;
    const survey = actions.scheduleSurvey(deal.id, { installerId: 'installer-1', scheduledAt: '2026-05-25T09:00', location: deal.leadSnapshot.location }).data!;
    for (const category of ['main_breaker_panel', 'roof_surface', 'inverter_location', 'wire_run_path'] as const) {
      actions.uploadSurveyEvidence(survey.id, { category, fileName: `${category}.jpg`, mimeType: 'image/jpeg', storagePath: `${survey.id}/${category}.jpg` });
    }
    actions.setSurveyStructuralSoundness(survey.id, true);
    actions.validateSurvey(survey.id);

    for (const category of ['customer_bill', 'valid_id', 'site_control_document'] as const) {
      const document = actions.uploadDocument({ leadId: lead.id, category, fileName: `${category}.pdf`, mimeType: 'application/pdf', storagePath: `${lead.id}/${category}.pdf`, uploadedBy: 'sales-1' }).data!;
      actions.validateDocument(document.id, 'cs-1');
    }

    const proposal = actions.createProposal(deal.id, { systemSizeKwp: 7.54 });

    expect(proposal.ok).toBe(true);
    expect(state.deals.find((item) => item.id === deal.id)?.documentStatus).toBe('validated');
  });

  it('replaces and deletes lead-level document files while keeping proposal gates synced', () => {
    let state = createInitialSolarOpsState();
    const actions = createSolarOpsActions(() => state, (next) => { state = next; });

    const lead = actions.createLead({
      businessName: 'Vault Store',
      contactName: 'Rina Santos',
      phone: '09170007777',
      source: 'd2d',
      location: '',
      latitude: 10.816663,
      longitude: 122.542422,
      monthlyBill: 52000,
      goal: 'lower_bill',
      siteControl: 'owned',
      assignedSales: 'sales-1',
      daytimeUsage: 'high',
    }).data!;
    actions.qualifyLead(lead.id);
    const deal = actions.createDealFromLead(lead.id, { name: 'Vault rooftop', salesOwner: 'sales-1' }).data!;
    const document = actions.uploadDocument({
      leadId: lead.id,
      category: 'customer_bill',
      fileName: 'bill.pdf',
      mimeType: 'application/pdf',
      storagePath: `${lead.id}/customer_bill/bill.pdf`,
      uploadedBy: 'sales-1',
      fileDataUrl: 'data:application/pdf;base64,old',
      fileSizeBytes: 100,
    }).data!;
    actions.validateDocument(document.id, 'cs-1');

    const replaced = actions.replaceDocumentFile(document.id, {
      fileName: 'new-bill.pdf',
      mimeType: 'application/pdf',
      storagePath: `${lead.id}/customer_bill/new-bill.pdf`,
      fileDataUrl: 'data:application/pdf;base64,new',
      fileSizeBytes: 200,
    }).data!;

    expect(replaced.fileName).toBe('new-bill.pdf');
    expect(replaced.validationStatus).toBe('pending_validation');
    expect(state.deals.find((item) => item.id === deal.id)?.documentStatus).toBe('pending_validation');

    const deleted = actions.deleteDocument(document.id);

    expect(deleted.ok).toBe(true);
    expect(state.documents.find((item) => item.id === document.id)).toBeUndefined();
    expect(state.deals.find((item) => item.id === deal.id)?.documentStatus).toBe('missing');
  });

  it('runs the canonical lead to won lifecycle across separate collections', () => {
    let state = createInitialSolarOpsState();
    const actions = createSolarOpsActions(() => state, (next) => { state = next; });

    const lead = actions.createLead({
      businessName: 'Santos Bakery',
      contactName: 'Maria Santos',
      phone: '09171234567',
      source: 'd2d',
      location: 'Makati City',
      utilityProvider: 'Meralco',
      monthlyBill: 68000,
      goal: 'lower_bill',
      siteControl: 'owned',
      assignedSales: 'sales-1',
      daytimeUsage: 'high',
    }).data!;

    actions.qualifyLead(lead.id);
    const deal = actions.createDealFromLead(lead.id, { name: 'Santos Bakery rooftop', salesOwner: 'sales-1' }).data!;
    actions.runSolarSnapshot(lead.id, deal.id, { latitude: 14.5547, longitude: 121.0244 });
    const survey = actions.scheduleSurvey(deal.id, { installerId: 'installer-1', scheduledAt: '2026-05-25T09:00', location: 'Makati City' }).data!;

    for (const category of ['main_breaker_panel', 'roof_surface', 'inverter_location', 'wire_run_path'] as const) {
      actions.uploadSurveyEvidence(survey.id, { category, fileName: `${category}.jpg`, mimeType: 'image/jpeg', storagePath: `${survey.id}/${category}.jpg` });
    }

    actions.setSurveyStructuralSoundness(survey.id, true);
    actions.validateSurvey(survey.id);

    const bill = actions.uploadDocument({ leadId: lead.id, dealId: deal.id, category: 'customer_bill', fileName: 'bill.pdf', mimeType: 'application/pdf', storagePath: 'lead/bill.pdf', uploadedBy: 'sales-1' }).data!;
    const id = actions.uploadDocument({ leadId: lead.id, dealId: deal.id, category: 'valid_id', fileName: 'id.jpg', mimeType: 'image/jpeg', storagePath: 'lead/id.jpg', uploadedBy: 'sales-1' }).data!;
    const site = actions.uploadDocument({ leadId: lead.id, dealId: deal.id, category: 'site_control_document', fileName: 'lease.pdf', mimeType: 'application/pdf', storagePath: 'lead/lease.pdf', uploadedBy: 'sales-1' }).data!;
    actions.validateDocument(bill.id, 'cs-1');
    actions.validateDocument(id.id, 'cs-1');
    actions.validateDocument(site.id, 'cs-1');

    const proposal = actions.createProposal(deal.id, { systemSizeKwp: 10 }).data!;
    actions.freezeProposal(proposal.id);
    const portal = actions.shareClientPortal(deal.id).data!;
    const contract = actions.generateContract(deal.id, proposal.id).data!;
    actions.acceptContract(contract.token, 'Maria Santos');
    actions.markDealWon(deal.id, 'Contract accepted.');

    expect(state.leads).toHaveLength(1);
    expect(state.deals[0].stage).toBe('won');
    expect(state.surveys[0].validationOutcome).toBe('validated');
    expect(state.proposals[0].status).toBe('accepted');
    expect(state.clientPortals[0].id).toBe(portal.id);
    expect(state.clients[0].businessName).toBe('Santos Bakery');
    expect(state.timelineEvents.length).toBeGreaterThan(8);
  });
});
