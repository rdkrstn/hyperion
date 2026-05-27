import { Link, useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useSolarOps } from '../../../shared/api/SolarOpsProvider';
import { Badge, EmptyState, Info, PageHeader, Panel, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableWrap } from '../../../shared/ui/primitives';
import { php, titleize } from '../../../shared/utils/format';
import { proposalDocumentGate } from '../../documents/services/documentService';
import { SolarWorkbench } from '../../solar-snapshot/components/SolarWorkbench';
import { buildNetMeteringWorkflowView } from '../../net-metering/services/netMeteringWorkflowService';
import { NetMeteringWorkflowPanel } from '../../net-metering/components/NetMeteringWorkflowPanel';
import { ProposalDocument } from '../components/ProposalDocument';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export function ProposalsPage() {
  const { dealId } = useParams();
  const { state, actions } = useSolarOps();
  const [selectedDealId, setSelectedDealId] = useState(dealId ?? state.deals[0]?.id ?? '');
  const [systemSizeKwp, setSystemSizeKwp] = useState(10);
  const [message, setMessage] = useState('');
  const selectedDeal = state.deals.find((deal) => deal.id === selectedDealId);
  const selectedSolar = selectedDeal
    ? state.solarSnapshots.find((snapshot) => snapshot.dealId === selectedDeal.id || snapshot.leadId === selectedDeal.leadId)
    : undefined;
  const linkedDocuments = selectedDeal ? state.documents.filter((document) => document.dealId === selectedDeal.id || document.leadId === selectedDeal.leadId) : [];
  const selectedLead = selectedDeal ? state.leads.find((lead) => lead.id === selectedDeal.leadId) : undefined;
  const selectedSurveys = selectedDeal ? state.surveys.filter((survey) => survey.dealId === selectedDeal.id) : [];
  const documentGate = selectedDeal
    ? proposalDocumentGate({ documents: linkedDocuments, dealId: selectedDeal.id, leadId: selectedDeal.leadId })
    : undefined;
  const netMeteringView = selectedDeal ? buildNetMeteringWorkflowView({
    deal: selectedDeal,
    documents: linkedDocuments,
    surveys: selectedSurveys,
    utilityProvider: selectedLead?.siteProfile.utilityProvider,
  }) : undefined;
  const proposals = state.proposals.filter((proposal) => proposal.dealId === selectedDealId);
  const activeProposal = proposals.find((proposal) => proposal.isActive);
  const contract = activeProposal ? state.proposalContracts.find((item) => item.proposalId === activeProposal.id) : undefined;
  const checks = selectedDeal ? [
    { label: 'Survey validated', passed: selectedDeal.surveyStatus === 'validated', detail: titleize(selectedDeal.surveyStatus) },
    { label: 'Documents validated', passed: Boolean(documentGate?.allowed), detail: documentGate?.allowed ? 'Validated' : documentGate?.reason ?? 'Select a deal' },
    { label: 'Net-metering gate', passed: Boolean(netMeteringView?.readyForProposal), detail: netMeteringView?.nextAction ?? 'Select a deal' },
    { label: 'Solar Snapshot finalized', passed: Boolean(selectedSolar?.selectedPanelCount), detail: selectedSolar ? `${selectedSolar.selectedPanelCount} panels / ${selectedSolar.selectedSystemSizeKwp} kWp` : 'Run Solar Snapshot' },
    { label: 'Formal proposal draft', passed: Boolean(activeProposal), detail: activeProposal ? `Revision ${activeProposal.revision}` : 'Create a draft' },
    { label: 'Pricing approval', passed: !activeProposal || activeProposal.grossMarginPercent >= 25 || activeProposal.status === 'approved', detail: activeProposal ? `${activeProposal.grossMarginPercent}% margin` : 'Pending draft' },
    { label: 'Frozen proposal', passed: Boolean(activeProposal?.frozenAt), detail: activeProposal?.frozenAt ? 'Frozen' : 'Freeze before contract' },
    { label: 'Contract link', passed: Boolean(contract), detail: contract ? contract.status : 'Not generated' },
  ] : [];

  useEffect(() => {
    if (selectedSolar?.selectedSystemSizeKwp) {
      setSystemSizeKwp(selectedSolar.selectedSystemSizeKwp);
    }
  }, [selectedDealId, selectedSolar?.selectedSystemSizeKwp]);

  function buildProposal() {
    if (!selectedDeal) return;
    const result = actions.createProposal(selectedDeal.id, { systemSizeKwp });
    setMessage(result.message ?? result.error ?? '');
  }

  function freeze() {
    if (!activeProposal) return;
    const result = actions.freezeProposal(activeProposal.id);
    setMessage(result.message ?? result.error ?? '');
  }

  function generateContract() {
    if (!selectedDeal || !activeProposal) return;
    const result = actions.generateContract(selectedDeal.id, activeProposal.id);
    setMessage(result.message ?? result.error ?? '');
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Proposals" description="Formal scope builder, margin approval state, contract readiness, and mocked payment flow." />
      {message ? <Alert><AlertDescription>{message}</AlertDescription></Alert> : null}
      <Panel title="Select deal and build proposal">
        <div className="grid gap-3 md:grid-cols-4">
          <div className="md:col-span-2">
            <Select value={selectedDealId} onValueChange={setSelectedDealId}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Select deal" /></SelectTrigger>
              <SelectContent>{state.deals.map((deal) => <SelectItem key={deal.id} value={deal.id}>{deal.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Input type="number" value={systemSizeKwp} onChange={(event) => setSystemSizeKwp(Number(event.target.value))} />
            {selectedSolar ? <p className="text-xs text-muted-foreground">From Solar Snapshot: {selectedSolar.selectedPanelCount} panels / {selectedSolar.selectedSystemSizeKwp} kWp</p> : null}
          </div>
          <Button disabled={!selectedDeal || !documentGate?.allowed || !netMeteringView?.readyForProposal} onClick={buildProposal}>
            {documentGate && !documentGate.allowed
              ? `Missing: ${documentGate.requirements.find((item) => !item.passed)?.label}`
              : netMeteringView && !netMeteringView.readyForProposal
                ? 'Net-metering blocked'
                : 'Create proposal draft'}
          </Button>
        </div>
        {selectedDeal && documentGate ? (
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {documentGate.requirements.map((requirement) => (
              <div key={requirement.category} className="rounded-lg border p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium">{requirement.label}</p>
                  <Badge tone={requirement.passed ? 'success' : requirement.status === 'rejected' ? 'error' : 'warning'}>{titleize(requirement.status)}</Badge>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {requirement.matchedDocument ? <Link className="underline underline-offset-4" to={`/documents/${requirement.matchedDocument.id}`}>{requirement.matchedDocument.fileName}</Link> : requirement.blockingReason}
                </p>
              </div>
            ))}
          </div>
        ) : null}
      </Panel>
      {selectedDeal ? (
        <NetMeteringWorkflowPanel view={netMeteringView} />
      ) : null}
      {selectedDeal ? (
        <Panel title="Solar Snapshot for proposal">
          {selectedSolar ? (
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-4">
                <Info label="Roof cap" value={`${selectedSolar.roofCapacityKwp} kWp`} />
                <Info label="Selected panels" value={`${selectedSolar.selectedPanelCount}/${selectedSolar.maxPanels}`} />
                <Info label="Selected size" value={`${selectedSolar.selectedSystemSizeKwp} kWp`} />
                <Info label="Production" value={`${selectedSolar.annualProductionKwh.toLocaleString()} kWh/yr`} />
              </div>
              <SolarWorkbench snapshot={selectedSolar} onApply={(input) => actions.updateSolarPanelLayout(selectedSolar.id, input)} />
              <p className="text-sm text-muted-foreground">Creating a proposal draft captures this Solar Snapshot panel layout into the proposal. Later panel changes create a new proposal revision.</p>
            </div>
          ) : <EmptyState text="Run Solar Snapshot before proposal. The proposal will freeze the selected panel layout." />}
        </Panel>
      ) : null}
      {selectedDeal ? (
        <div className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
          <Panel title="Contract readiness">
            <div className="space-y-3">
              {checks.map((check, index) => (
                <div key={check.label} className="flex items-start gap-3 rounded-lg border p-3">
                  <Badge tone={check.passed ? 'success' : 'warning'}>{index + 1}</Badge>
                  <div>
                    <p className="font-medium">{check.label}</p>
                    <p className="text-sm text-muted-foreground">{check.detail}</p>
                  </div>
                </div>
              ))}
              <Info label="Contract" value={contract ? <Link className="underline underline-offset-4" to={`/contracts/${contract.token}`}>{contract.publicUrl}</Link> : 'Not generated'} />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button size="sm" variant="outline" disabled={!activeProposal} onClick={freeze}>Freeze proposal</Button>
              <Button size="sm" disabled={!activeProposal?.frozenAt} onClick={generateContract}>Generate contract</Button>
            </div>
          </Panel>
          <Panel title="Scope lines">
            {activeProposal ? (
              <div className="space-y-4">
                {activeProposal.solarSnapshotSummary ? (
                  <div className="grid gap-3 rounded-lg border bg-muted/30 p-3 md:grid-cols-4">
                    <Info label="Finalized panels" value={`${activeProposal.solarSnapshotSummary.selectedPanelCount}/${activeProposal.solarSnapshotSummary.maxPanels}`} />
                    <Info label="Finalized size" value={`${activeProposal.solarSnapshotSummary.selectedSystemSizeKwp} kWp`} />
                    <Info label="Panel watts" value={`${activeProposal.solarSnapshotSummary.panelCapacityWatts} W`} />
                    <Info label="Solar production" value={`${activeProposal.solarSnapshotSummary.annualProductionKwh.toLocaleString()} kWh/yr`} />
                  </div>
                ) : null}
                <TableWrap>
                  <Table>
                    <TableHeader><TableRow><TableHead>Item</TableHead><TableHead>Qty</TableHead><TableHead>Unit</TableHead><TableHead>Total</TableHead><TableHead>Margin</TableHead><TableHead>Reason</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {activeProposal.scopeLines.map((line) => <TableRow key={line.id}><TableCell><span className="font-medium">{line.name}</span><p className="text-xs text-muted-foreground">{titleize(line.category)}</p></TableCell><TableCell>{line.quantity}</TableCell><TableCell>{php.format(line.unitPrice)}</TableCell><TableCell>{php.format(line.total)}</TableCell><TableCell>{line.marginPercent}%</TableCell><TableCell>{line.sourceReason}</TableCell></TableRow>)}
                    </TableBody>
                  </Table>
                </TableWrap>
              </div>
            ) : <EmptyState text="No proposal draft yet." />}
          </Panel>
        </div>
      ) : <EmptyState text="No deals available for proposal building." />}
      <Panel title="Proposal revisions">
        {proposals.length ? proposals.map((proposal) => <div key={proposal.id} className="flex items-center justify-between border-b border-base-300 py-2"><span>Revision {proposal.revision}</span><Badge tone={proposal.isActive ? 'success' : 'neutral'}>{titleize(proposal.status)}</Badge></div>) : <EmptyState text="No proposal revisions yet." />}
      </Panel>
      {selectedDeal && activeProposal ? (
        <Panel title="Customer-facing proposal preview">
          <ProposalDocument deal={selectedDeal} proposal={activeProposal} customerType={selectedLead?.customerType} netMeteringView={netMeteringView} />
        </Panel>
      ) : null}
    </div>
  );
}
