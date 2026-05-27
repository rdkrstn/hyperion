import { PDFDocument, StandardFonts } from 'https://esm.sh/pdf-lib@1.17.1';
import { createSupabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { logTimeline } from '../_shared/timeline.ts';
import { createGenerateComplianceDocsHandler, defaultComplianceRule, type ComplianceDocumentType } from './handler.ts';

const supabase = createSupabaseAdmin();

async function sha256(bytes: Uint8Array) {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function loadOfficialTemplate(documentType: ComplianceDocumentType, ruleVersion: string) {
  const storagePath = `${ruleVersion}/${documentType}.pdf`;
  const { data, error } = await supabase.storage.from('compliance-doc-templates').download(storagePath);
  if (error || !data) return undefined;
  return {
    documentType,
    version: ruleVersion,
    bytes: new Uint8Array(await data.arrayBuffer()),
  };
}

Deno.serve(createGenerateComplianceDocsHandler({
  async loadContext(leadId, signerName) {
    const [{ data: lead, error: leadError }, { data: site, error: siteError }, { data: deal, error: dealError }, { data: rule, error: ruleError }] = await Promise.all([
      supabase.from('leads').select('id,business_name,contact_name').eq('id', leadId).single(),
      supabase.from('lead_site_profiles').select('address,formatted_address,utility_provider').eq('lead_id', leadId).maybeSingle(),
      supabase.from('deals').select('id').eq('lead_id', leadId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('compliance_rules').select('version').eq('active', true).order('effective_at', { ascending: false }).limit(1).maybeSingle(),
    ]);
    const failed = [leadError, siteError, dealError, ruleError].find(Boolean);
    if (failed) throw failed;

    let systemSizeKwp = 0;
    if (deal?.id) {
      const { data: proposal, error: proposalError } = await supabase
        .from('proposals')
        .select('system_size_kwp')
        .eq('deal_id', deal.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (proposalError) throw proposalError;
      systemSizeKwp = Number(proposal?.system_size_kwp ?? 0);
    }
    if (!systemSizeKwp) {
      const { data: snapshot, error: snapshotError } = await supabase
        .from('solar_snapshots')
        .select('roof_capacity_kwp')
        .eq('lead_id', leadId)
        .order('reviewed_at', { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle();
      if (snapshotError) throw snapshotError;
      systemSizeKwp = Number(snapshot?.roof_capacity_kwp ?? 0);
    }

    return {
      leadId,
      businessName: lead.business_name,
      contactName: lead.contact_name,
      address: site?.formatted_address ?? site?.address ?? '',
      utilityProvider: site?.utility_provider ?? '',
      systemSizeKwp,
      signerName,
      ruleVersion: rule?.version ?? defaultComplianceRule.version,
    };
  },
  loadTemplate: loadOfficialTemplate,
  async renderPdf(template, context) {
    const pdf = await PDFDocument.load(template.bytes);
    const page = pdf.getPage(0) ?? pdf.addPage();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const draw = (label: string, x: number, y: number) => page.drawText(label, { x, y, size: 9, font });
    draw(context.businessName, 96, 680);
    draw(context.contactName, 96, 660);
    draw(context.address, 96, 640);
    draw(context.utilityProvider, 96, 620);
    draw(`${context.systemSizeKwp} kWp`, 96, 600);
    draw(context.signerName, 96, 560);
    draw(new Date().toISOString().slice(0, 10), 96, 540);
    return new Uint8Array(await pdf.save());
  },
  async storePdf({ leadId, documentType, ruleVersion, bytes }) {
    const storagePath = `${leadId}/${documentType}-${ruleVersion}.pdf`;
    const { error } = await supabase.storage.from('compliance-documents').upload(storagePath, new Blob([bytes], { type: 'application/pdf' }), {
      contentType: 'application/pdf',
      upsert: true,
    });
    if (error) throw error;
    return { storagePath, sha256: await sha256(bytes) };
  },
  async recordDocuments({ leadId, actorRole, signerName, ruleVersion, documents }) {
    const { data: deal } = await supabase.from('deals').select('id').eq('lead_id', leadId).order('created_at', { ascending: false }).limit(1).maybeSingle();
    const responses = await Promise.all([
      supabase.from('documents').upsert(documents.map((document) => ({
        lead_id: leadId,
        deal_id: deal?.id ?? null,
        category: 'generated_compliance_pdf',
        file_name: `${document.documentType}-${ruleVersion}.pdf`,
        mime_type: 'application/pdf',
        bucket: 'compliance-documents',
        storage_path: document.storagePath,
        status: 'validated',
        reviewer_notes: `Generated from ${document.documentType} template ${document.templateVersion}; sha256=${document.sha256}; signer=${signerName}.`,
      })), { onConflict: 'bucket,storage_path' }),
      supabase.from('net_metering_workflows').upsert({
        lead_id: leadId,
        deal_id: deal?.id ?? null,
        status: 'compliance_docs_generated',
        rule_version: ruleVersion,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'lead_id' }),
    ]);
    const failed = responses.find((response) => response.error);
    if (failed?.error) throw failed.error;
    await logTimeline(supabase, {
      ownerType: deal?.id ? 'deal' : 'lead',
      ownerId: deal?.id ?? leadId,
      leadId,
      dealId: deal?.id ?? undefined,
      title: 'Compliance PDFs generated',
      description: `${documents.length} documents generated using rule ${ruleVersion}.`,
      actorRole,
    });
    return { leadId, documents };
  },
}));
