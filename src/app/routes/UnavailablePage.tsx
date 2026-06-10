import { Link, useLocation } from 'react-router-dom';
import { AlertCircle, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { unavailableRouteFor } from './routeConfig';

export function UnavailablePage() {
  const location = useLocation();
  const route = unavailableRouteFor(location.pathname);
  const replacement = route?.canonicalReplacement ?? '/dashboard';

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4 py-10">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <div className="mb-2 flex items-center gap-2">
            <span className="rounded-full border bg-muted p-2 text-muted-foreground">
              <AlertCircle className="size-4" />
            </span>
            <Badge variant="secondary">{route?.legacy ? 'Removed route' : 'Unavailable route'}</Badge>
          </div>
          <CardTitle>{route?.label ?? 'This page is not part of the clean demo'}</CardTitle>
          <CardDescription>
            {route?.unavailableReason ?? 'The requested route is not available in the current Hyperion public demo workspace.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Separator />
          <div className="rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">
            Current path: <span className="font-mono text-foreground">{location.pathname}</span>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button asChild>
              <Link to={replacement}>
                Go to replacement
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/dashboard">Back to dashboard</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
