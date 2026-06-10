import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { canAccessRoute, visibleRoutesForRole } from '../routes/routeConfig';
import { useSolarOps } from '../../shared/api/SolarOpsProvider';
import type { Role } from '../../shared/types/app';
import { Menu, RotateCcw, Sparkles, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { buildGoldenDemoModel } from '../../shared/demo/goldenDemo';

const roles: Role[] = ['owner', 'manager', 'sales', 'cs', 'installer'];

function SidebarNav({ routes }: { routes: ReturnType<typeof visibleRoutesForRole> }) {
  return (
    <nav className="flex h-full flex-col">
      <Link to="/dashboard" className="block px-1 pb-5">
        <div className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-lg border bg-amber-50 text-amber-700">
            <Zap className="size-4" />
          </span>
          <div>
            <p className="text-lg font-semibold">Hyperion</p>
            <p className="text-xs text-muted-foreground">From inquiry to install</p>
          </div>
        </div>
      </Link>
      <Separator className="mb-4" />
      <div className="space-y-1">
        {routes.map((route) => (
          <NavLink
            key={route.path}
            to={route.path}
            className={({ isActive }) =>
              `flex items-center justify-between rounded-lg px-3 py-2 text-sm transition ${
                isActive ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`
            }
          >
            <span>{route.label}</span>
          </NavLink>
        ))}
      </div>
      <div className="mt-auto rounded-lg border bg-white p-3">
        <Badge variant="secondary" className="border-amber-200 bg-amber-50 text-amber-800">v1 public demo</Badge>
        <p className="mt-3 text-xs text-muted-foreground">Local-first reference workflow with Supabase boundaries scaffolded for production integration.</p>
      </div>
    </nav>
  );
}

export function AppLayout() {
  const { state, actions, activeRole, setActiveRole } = useSolarOps();
  const location = useLocation();
  const routes = visibleRoutesForRole(activeRole);
  const demo = buildGoldenDemoModel(state);

  if (!canAccessRoute(location.pathname, activeRole)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <Card className="w-full max-w-xl">
          <CardHeader>
            <Badge className="w-fit" variant="secondary">Role gate</Badge>
            <CardTitle>Route unavailable for {activeRole}</CardTitle>
            <CardDescription>This role does not have access to the requested workspace.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link to={routes[0]?.path ?? '/dashboard'}>Go to workspace</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 hidden w-72 border-r bg-card/90 p-4 lg:block">
        <SidebarNav routes={routes} />
      </aside>
      <div className="lg:pl-72">
        <header className="sticky top-0 z-20 border-b bg-background/90 backdrop-blur">
          <div className="flex flex-col gap-3 px-4 py-3 xl:flex-row xl:items-center xl:justify-between lg:px-6">
            <div className="flex items-center gap-3">
              <Sheet>
                <SheetTrigger asChild>
                  <Button className="lg:hidden" size="icon" variant="outline" aria-label="Open navigation">
                    <Menu className="size-4" />
                  </Button>
                </SheetTrigger>
                <SheetContent className="w-80" side="left">
                  <SheetHeader className="text-left">
                    <SheetTitle>Hyperion</SheetTitle>
                    <SheetDescription>Solar workflow cockpit</SheetDescription>
                  </SheetHeader>
                  <div className="mt-5">
                    <SidebarNav routes={routes} />
                  </div>
                </SheetContent>
              </Sheet>
              <div>
                <p className="text-sm font-semibold">Solar workflow cockpit</p>
                <p className="text-xs text-muted-foreground">{demo.loaded ? `${demo.accountName}: ${demo.progressPercent}% demo progress` : 'Load the golden demo to follow one customer end to end'}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => actions.loadGoldenDemo()}>
                <Sparkles className="size-4" />
                Load golden demo
              </Button>
              <Button size="sm" onClick={() => actions.runGoldenDemoNextStep()}>{demo.loaded ? demo.nextAction : 'Run demo'}</Button>
              <Button size="icon" variant="ghost" aria-label="Reset local demo" onClick={() => actions.resetDemo()}>
                <RotateCcw className="size-4" />
              </Button>
              <Badge className="hidden sm:inline-flex" variant="outline">Local role</Badge>
              <Select value={activeRole} onValueChange={(value) => setActiveRole(value as Role)}>
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((role) => <SelectItem key={role} value={role}>{role}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </header>
        <main className="mx-auto min-h-[calc(100vh-57px)] w-full max-w-7xl p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
