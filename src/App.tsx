import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { SolarOpsProvider } from './shared/api/SolarOpsProvider';
import { AppLayout } from './app/layout/AppLayout';
import { DashboardPage } from './app/routes/DashboardPage';
import { PipelinePage } from './app/routes/PipelinePage';
import { WorkbenchPage } from './app/routes/WorkbenchPage';
import { CalendarPage } from './app/routes/CalendarPage';
import { DocsPage } from './app/routes/DocsPage';
import { PortalLinksPage } from './app/routes/PortalLinksPage';
import { SettingsPage } from './app/routes/SettingsPage';
import { SigninPage } from './app/routes/SigninPage';
import { LeadsPage } from './domains/leads/pages/LeadsPage';
import { NewLeadPage } from './domains/leads/pages/NewLeadPage';
import { LeadDetailPage } from './domains/leads/pages/LeadDetailPage';
import { DealsPage } from './domains/deals/pages/DealsPage';
import { DealDetailPage } from './domains/deals/pages/DealDetailPage';
import { SurveysPage } from './domains/surveys/pages/SurveysPage';
import { SurveyDetailPage } from './domains/surveys/pages/SurveyDetailPage';
import { DocumentsPage } from './domains/documents/pages/DocumentsPage';
import { DocumentViewerPage } from './domains/documents/pages/DocumentViewerPage';
import { ProposalsPage } from './domains/proposals/pages/ProposalsPage';
import { ContractPage } from './domains/proposals/pages/ContractPage';
import { SolarWorkbenchPage } from './domains/solar-snapshot/pages/SolarWorkbenchPage';
import { PortalPage } from './domains/client-portal/pages/PortalPage';
import { RemoteIntakePage } from './domains/client-portal/pages/RemoteIntakePage';
import { TicketsPage } from './domains/tickets/pages/TicketsPage';
import { AnalyticsPage } from './domains/analytics/pages/AnalyticsPage';
import { AutomationsPage } from './domains/automations/pages/AutomationsPage';
import { UnavailablePage } from './app/routes/UnavailablePage';
import { legacyUnavailableRoutes } from './app/routes/routeConfig';
import { TooltipProvider } from '@/components/ui/tooltip';

function App() {
  return (
    <SolarOpsProvider>
      <TooltipProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/signin" element={<SigninPage />} />
            <Route path="/inquiry" element={<NewLeadPage />} />
            <Route path="/remote-intake/:token" element={<RemoteIntakePage />} />
            <Route path="/portal/:token" element={<PortalPage />} />
            <Route path="/contracts/:token" element={<ContractPage />} />
            <Route element={<AppLayout />}>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/pipeline" element={<PipelinePage />} />
              <Route path="/workbench" element={<WorkbenchPage />} />
              <Route path="/automations" element={<AutomationsPage />} />
              <Route path="/docs" element={<DocsPage />} />
              <Route path="/leads" element={<LeadsPage />} />
              <Route path="/leads/new" element={<NewLeadPage />} />
              <Route path="/leads/:id" element={<LeadDetailPage />} />
              <Route path="/deals" element={<DealsPage />} />
              <Route path="/deals/:id" element={<DealDetailPage />} />
              <Route path="/surveys" element={<SurveysPage />} />
              <Route path="/surveys/:id" element={<SurveyDetailPage />} />
              <Route path="/documents" element={<DocumentsPage />} />
              <Route path="/documents/:id" element={<DocumentViewerPage />} />
              <Route path="/proposals" element={<ProposalsPage />} />
              <Route path="/proposals/:dealId" element={<ProposalsPage />} />
              <Route path="/solar-snapshots/:id" element={<SolarWorkbenchPage />} />
              <Route path="/calendar" element={<CalendarPage />} />
              <Route path="/calendar/:id" element={<CalendarPage />} />
              <Route path="/portal-links" element={<PortalLinksPage />} />
              <Route path="/tickets" element={<TicketsPage />} />
              <Route path="/tickets/:id" element={<TicketsPage />} />
              <Route path="/analytics" element={<AnalyticsPage />} />
              <Route path="/analytics/:id" element={<AnalyticsPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/profile" element={<SettingsPage />} />
              <Route path="/staff" element={<SettingsPage />} />
              {legacyUnavailableRoutes.map((route) => (
                <Route key={route.path} path={`${route.path}/*`} element={<UnavailablePage />} />
              ))}
              <Route path="*" element={<UnavailablePage />} />
            </Route>
            <Route path="*" element={<UnavailablePage />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </SolarOpsProvider>
  );
}

export default App;
