import { useParams } from 'react-router-dom';
import { EmptyState, PageHeader, Panel } from '../../../shared/ui/primitives';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';

const uploadSlots = [
  { key: 'electric_bill', label: 'Electric Bill', helper: 'Used for OCR pre-audit and readiness scoring.' },
  { key: 'valid_id', label: 'Valid ID', helper: 'Required for document readiness.' },
  { key: 'site_control', label: 'Site-Control Document', helper: 'Title, lease, or authorization proof.' },
];

export function RemoteIntakePage() {
  const { token = '' } = useParams();

  if (!token) return <div className="min-h-screen bg-background p-4"><EmptyState text="Remote intake link is missing a token." /></div>;

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="mx-auto max-w-2xl space-y-6">
        <PageHeader title="Upload Documents" description="Secure remote intake for electric bill, valid ID, and site-control documents." />
        <Panel title="Required uploads">
          <div className="space-y-4">
            {uploadSlots.map((slot) => (
              <label key={slot.key} className="block rounded-xl border-2 border-dashed bg-card p-5 transition hover:border-primary">
                <span className="block text-lg font-semibold">{slot.label}</span>
                <span className="block text-sm text-muted-foreground">{slot.helper}</span>
                <Input className="mt-4" type="file" accept="image/*,application/pdf" capture="environment" />
              </label>
            ))}
          </div>
        </Panel>
        <Alert><AlertDescription>Production uploads validate the DB token and signed JWT through the remote-intake-access Edge Function before writing private Storage references.</AlertDescription></Alert>
      </div>
    </div>
  );
}
