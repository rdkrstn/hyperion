import { CheckCircle2, CircleAlert } from 'lucide-react';
import { Badge, Info, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableWrap } from '../../../shared/ui/primitives';
import { php, titleize } from '../../../shared/utils/format';
import type { DealRecord } from '../../deals/types';
import type { CustomerType } from '../../leads/types';
import type { NetMeteringWorkflowView } from '../../net-metering/types';
import { buildProposalPresentation } from '../services/proposalPresentationService';
import type { ProposalRecord } from '../types';

interface ProposalDocumentProps {
  deal: DealRecord;
  proposal: ProposalRecord;
  customerType?: CustomerType;
  netMeteringView?: NetMeteringWorkflowView;
  contractStatus?: string;
}

export function ProposalDocument({ deal, proposal, customerType, netMeteringView, contractStatus }: ProposalDocumentProps) {
  const presentation = buildProposalPresentation({
    deal,
    proposal,
    customerType,
    netMeteringSteps: netMeteringView?.steps ?? [],
  });

  return (
    <article className="mx-auto max-w-5xl rounded-xl border bg-white p-6 text-slate-950 shadow-sm print:border-0 print:shadow-none md:p-10">
      <header className="grid gap-6 border-b pb-8 md:grid-cols-[1fr_auto]">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-700">Solar proposal</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">{presentation.system.title}</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">Prepared for {presentation.preparedFor.customerName}. This proposal summarizes the system, assumptions, scope, timeline, and typed acceptance terms.</p>
        </div>
        <div className="rounded-lg border p-4 text-sm">
          <p className="text-slate-500">Ref. No.</p>
          <p className="font-semibold">{presentation.preparedFor.reference}</p>
          <p className="mt-3 text-slate-500">Status</p>
          <p className="font-semibold">{contractStatus ?? titleize(proposal.status)}</p>
        </div>
      </header>

      <section className="grid gap-4 border-b py-8 md:grid-cols-2">
        <div className="rounded-lg border p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">Prepared for</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Info label="Client name" value={presentation.preparedFor.customerName} />
            <Info label="Contact" value={presentation.preparedFor.contactName} />
            <Info label="Property address" value={presentation.preparedFor.propertyAddress} />
            <Info label="Payment option" value={deal.commercialPacket.paymentOption} />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Info label="System capacity" value={`${presentation.system.systemSizeKwp.toFixed(2)} kWp`} />
          <Info label="Panel count" value={`${presentation.system.panelCount} panels`} />
          <Info label="Annual production" value={`${presentation.system.annualProductionKwh.toLocaleString()} kWh`} />
          <Info label="Est. monthly savings" value={php.format(presentation.system.monthlySavings)} />
          <Info label="Payback period" value={`${presentation.system.paybackYears} yrs`} />
          <Info label="Project investment" value={php.format(proposal.subtotal)} />
        </div>
      </section>

      <section className="border-b py-8">
        <SectionTitle title={presentation.useCaseSection.kind === 'residential' ? 'Appliances it can power' : 'Business value case'} />
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {presentation.useCaseSection.items.map((item) => (
            <div key={item.title} className="rounded-lg border p-4">
              <p className="font-semibold">{item.title}</p>
              <p className="text-sm text-slate-600">{item.detail}</p>
              {item.value ? <p className="mt-2 text-sm font-semibold text-amber-700">{item.value}</p> : null}
            </div>
          ))}
        </div>
      </section>

      <section className="border-b py-8">
        <SectionTitle title="Scope of work" />
        <div className="mt-4 grid gap-6 lg:grid-cols-2">
          <ScopeList title="Included" items={presentation.inclusions} included />
          <ScopeList title="Additional if required" items={presentation.exclusions} />
        </div>
      </section>

      <section className="border-b py-8">
        <SectionTitle title="Investment summary" />
        <div className="mt-4">
        <TableWrap>
          <Table>
            <TableHeader>
              <TableRow><TableHead>Item / description</TableHead><TableHead>U/M</TableHead><TableHead>Qty</TableHead><TableHead>Unit price</TableHead><TableHead>Total</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {proposal.scopeLines.map((line) => (
                <TableRow key={line.id}>
                  <TableCell><span className="font-medium">{line.name}</span><p className="text-xs text-slate-500">{line.sourceReason}</p></TableCell>
                  <TableCell>{line.unit}</TableCell>
                  <TableCell>{line.quantity}</TableCell>
                  <TableCell>{php.format(line.unitPrice)}</TableCell>
                  <TableCell className="font-semibold">{php.format(line.total)}</TableCell>
                </TableRow>
              ))}
              <TableRow>
                <TableCell colSpan={4} className="text-right font-semibold">Grand total amount</TableCell>
                <TableCell className="font-semibold">{php.format(proposal.subtotal)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TableWrap>
        </div>
      </section>

      <section className="grid gap-6 border-b py-8 lg:grid-cols-2">
        <div>
          <SectionTitle title="Warranty coverage" />
          <div className="mt-4 space-y-3">
            {presentation.warranty.map((item) => <Info key={item.title} label={item.title} value={`${item.detail}${item.value ? ` / ${item.value}` : ''}`} />)}
          </div>
        </div>
        <div>
          <SectionTitle title="Net-metering progress" />
          <div className="mt-4 space-y-3">
            {presentation.netMeteringSteps.length ? presentation.netMeteringSteps.map((step) => (
              <div key={step.id} className="flex items-start justify-between gap-3 rounded-lg border p-3">
                <div>
                  <p className="font-medium">{step.title}</p>
                  <p className="text-sm text-slate-600">{step.customerLabel}</p>
                </div>
                <Badge tone={step.status === 'complete' ? 'success' : step.status === 'blocked' ? 'error' : 'warning'}>{titleize(step.status)}</Badge>
              </div>
            )) : <p className="text-sm text-slate-600">Net-metering workflow will appear after staff review.</p>}
          </div>
        </div>
      </section>

      <section className="grid gap-6 border-b py-8 lg:grid-cols-2">
        <div>
          <SectionTitle title="Project timeline" />
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {presentation.timeline.map((item, index) => (
              <div key={item.title} className="rounded-lg border p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">Step {index + 1}</p>
                <p className="mt-2 font-semibold">{item.title}</p>
                <p className="mt-1 text-sm text-slate-600">{item.detail}</p>
                <p className="mt-3 text-sm font-semibold text-amber-700">{item.value}</p>
              </div>
            ))}
          </div>
        </div>
        <div>
          <SectionTitle title="Terms & conditions" />
          <ul className="mt-4 space-y-3 text-sm text-slate-700">
            {presentation.terms.map((term) => <li key={term} className="border-b pb-3">{term}</li>)}
          </ul>
        </div>
      </section>
    </article>
  );
}

function SectionTitle({ title }: { title: string }) {
  return <h2 className="border-l-4 border-amber-500 pl-3 text-sm font-semibold uppercase tracking-[0.18em] text-amber-700">{title}</h2>;
}

function ScopeList({ title, items, included = false }: { title: string; items: Array<{ title: string; detail: string }>; included?: boolean }) {
  return (
    <div>
      <p className="font-semibold">{title}</p>
      <div className="mt-3 divide-y rounded-lg border">
        {items.map((item) => (
          <div key={item.title} className="flex items-start justify-between gap-3 p-3">
            <div>
              <p className="font-medium">{item.title}</p>
              <p className="text-sm text-slate-600">{item.detail}</p>
            </div>
            {included ? <CheckCircle2 className="size-5 shrink-0 text-emerald-600" /> : <CircleAlert className="size-5 shrink-0 text-amber-600" />}
          </div>
        ))}
      </div>
    </div>
  );
}
