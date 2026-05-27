import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { requiredSurveyEvidence, surveyValidationGate } from '../services/surveyService';
import { useSolarOps } from '../../../shared/api/SolarOpsProvider';
import { Badge, EmptyState, Info, PageHeader, Panel } from '../../../shared/ui/primitives';
import { titleize } from '../../../shared/utils/format';
import type { SurveyEvidenceCategory } from '../types';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SolarWorkbench } from '../../solar-snapshot/components/SolarWorkbench';

const tabs = ['Site Context', 'Solar Snapshot', 'Evidence Uploads', 'Installer Findings', 'Validation', 'Timeline'];

export function SurveyDetailPage() {
  const { id = '' } = useParams();
  const { state, actions } = useSolarOps();
  const survey = state.surveys.find((item) => item.id === id);
  const [tab, setTab] = useState(tabs[0]);
  const [message, setMessage] = useState('');

  if (!survey) return <EmptyState text="Survey not found." action={<Button asChild variant="outline"><Link to="/surveys">Back to surveys</Link></Button>} />;
  const currentSurvey = survey;

  const deal = state.deals.find((item) => item.id === currentSurvey.dealId);
  const solar = state.solarSnapshots.find((snapshot) => snapshot.dealId === currentSurvey.dealId || snapshot.leadId === currentSurvey.leadId);
  const gate = surveyValidationGate(currentSurvey);
  const timeline = state.timelineEvents.filter((event) => event.ownerId === currentSurvey.id);

  function upload(category: SurveyEvidenceCategory, file?: File) {
    const fileName = file?.name ?? `${category}.jpg`;
    const result = actions.uploadSurveyEvidence(currentSurvey.id, {
      category,
      fileName,
      mimeType: file?.type || 'image/jpeg',
      storagePath: `${currentSurvey.id}/${category}/${fileName}`,
      previewUrl: file ? URL.createObjectURL(file) : undefined,
    });
    setMessage(result.message ?? result.error ?? '');
  }

  function validate() {
    const result = actions.validateSurvey(currentSurvey.id);
    setMessage(result.message ?? result.error ?? '');
  }

  return (
    <div className="space-y-6">
      <PageHeader title={deal?.name ?? 'Survey'} description={`${survey.location} / ${new Date(survey.scheduledAt).toLocaleString()}`} action={<Button asChild size="sm" variant="outline"><Link to="/surveys">Back to surveys</Link></Button>} />
      {message ? <Alert><AlertDescription>{message}</AlertDescription></Alert> : null}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="max-w-full flex-wrap justify-start">{tabs.map((item) => <TabsTrigger key={item} value={item}>{item}</TabsTrigger>)}</TabsList>

      <TabsContent value="Site Context" className="mt-4"><Panel title="Site info"><div className="grid gap-3 md:grid-cols-3"><Info label="Customer" value={deal?.leadSnapshot.businessName} /><Info label="Address" value={survey.location} /><Info label="Installer" value={survey.installerId} /></div></Panel></TabsContent>
      <TabsContent value="Solar Snapshot" className="mt-4"><Panel title="Solar Snapshot context">{solar ? <SolarWorkbench snapshot={solar} mode="readonly" /> : <EmptyState text="Solar Snapshot missing." />}</Panel></TabsContent>
      <TabsContent value="Evidence Uploads" className="mt-4">
        <Panel title="Rigid evidence checklist">
          <div className="grid gap-4 md:grid-cols-2">
            {requiredSurveyEvidence.map((category) => {
              const uploaded = survey.evidenceUploads.find((item) => item.category === category);
              return (
                <label key={category} className="block cursor-pointer rounded-lg border bg-muted/40 p-4 transition hover:border-primary">
                  <input className="hidden" type="file" accept="image/*" capture="environment" onChange={(event) => upload(category, event.target.files?.[0])} />
                  <div className="flex min-h-32 flex-col justify-between">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold">{titleize(category)}</p>
                      <Badge tone={uploaded ? 'success' : 'warning'}>{uploaded ? 'Uploaded' : 'Required'}</Badge>
                    </div>
                    {uploaded?.previewUrl ? <img className="mt-3 h-32 rounded-lg object-cover" src={uploaded.previewUrl} alt={`${category} evidence`} /> : <p className="mt-8 text-sm text-muted-foreground">Tap to open camera</p>}
                  </div>
                </label>
              );
            })}
          </div>
        </Panel>
      </TabsContent>
      <TabsContent value="Installer Findings" className="mt-4"><Panel title="Findings"><div className="flex flex-wrap gap-2"><Button onClick={() => actions.setSurveyStructuralSoundness(survey.id, true)}>Roof structurally sound</Button><Button variant="outline" onClick={() => actions.setSurveyStructuralSoundness(survey.id, false)}>Roof needs remediation</Button></div><p className="mt-3 text-sm">Current: {survey.isStructurallySound === undefined ? 'Not answered' : survey.isStructurallySound ? 'Yes' : 'No'}</p></Panel></TabsContent>
      <TabsContent value="Validation" className="mt-4"><Panel title="Validation gate">{!gate.allowed ? <Alert className="border-amber-200 bg-amber-50 text-amber-900"><AlertTitle>{survey.isStructurallySound === false ? 'Survey Blocked' : 'Survey cannot be completed yet'}</AlertTitle><AlertDescription>{survey.isStructurallySound === false ? 'Roof requires engineering remediation plan before proceeding.' : gate.reason}{gate.missing.length ? <span className="mt-2 block">Missing: {gate.missing.join(', ')}</span> : null}</AlertDescription></Alert> : <Alert className="border-emerald-200 bg-emerald-50 text-emerald-900"><AlertDescription>{gate.reason}</AlertDescription></Alert>}<Button className="mt-4" disabled={!gate.allowed} onClick={validate}>Complete Survey</Button></Panel></TabsContent>
      <TabsContent value="Timeline" className="mt-4"><Panel title="Timeline">{timeline.length ? timeline.map((event) => <div key={event.id} className="border-b py-2"><p className="font-medium">{event.title}</p><p className="text-sm text-muted-foreground">{event.description}</p></div>) : <EmptyState text="No survey timeline yet." />}</Panel></TabsContent>
      </Tabs>
    </div>
  );
}
