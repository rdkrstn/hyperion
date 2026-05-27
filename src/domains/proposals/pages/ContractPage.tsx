import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useSolarOps } from '../../../shared/api/SolarOpsProvider';
import { EmptyState, PageHeader, Panel } from '../../../shared/ui/primitives';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { buildNetMeteringWorkflowView } from '../../net-metering/services/netMeteringWorkflowService';
import { ProposalDocument } from '../components/ProposalDocument';

export function ContractPage() {
  const { token = '' } = useParams();
  const { state, actions } = useSolarOps();
  const [signerName, setSignerName] = useState('');
  const [message, setMessage] = useState('');
  const contract = state.proposalContracts.find((item) => item.token === token);
  const proposal = contract ? state.proposals.find((item) => item.id === contract.proposalId) : undefined;
  const deal = contract ? state.deals.find((item) => item.id === contract.dealId) : undefined;
  const lead = deal ? state.leads.find((item) => item.id === deal.leadId) : undefined;
  const documents = deal ? state.documents.filter((item) => item.dealId === deal.id || item.leadId === deal.leadId) : [];
  const surveys = deal ? state.surveys.filter((item) => item.dealId === deal.id) : [];
  const netMeteringView = deal ? buildNetMeteringWorkflowView({
    deal,
    documents,
    surveys,
    utilityProvider: lead?.siteProfile.utilityProvider,
  }) : undefined;

  if (!contract || !proposal || !deal) return <div className="min-h-screen bg-background p-4"><EmptyState text="Contract link unavailable." /></div>;

  function accept() {
    const result = actions.acceptContract(token, signerName);
    setMessage(result.message ?? result.error ?? '');
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="mx-auto max-w-6xl space-y-6">
        <PageHeader title={`${deal.leadSnapshot.businessName} Solar Proposal`} description="Review the finalized scope, pricing, timeline, and acceptance terms." />
        {message ? <Alert><AlertDescription>{message}</AlertDescription></Alert> : null}
        <ProposalDocument deal={deal} proposal={proposal} customerType={lead?.customerType} netMeteringView={netMeteringView} contractStatus={contract.status} />
        <Panel title="Typed acceptance">
          <p className="mb-3 text-sm text-muted-foreground">Type your full legal name to accept this proposal and contract terms. Acceptance creates the client record, invoice, and mocked payment ledger event.</p>
          <Input value={signerName} onChange={(event) => setSignerName(event.target.value)} placeholder="Type full legal name" />
          <Button className="mt-4 w-full" disabled={!signerName.trim() || contract.status === 'signed'} onClick={accept}>Accept contract</Button>
        </Panel>
      </div>
    </div>
  );
}
