import { Link } from 'react-router-dom';
import { PageHeader, Panel } from '../../shared/ui/primitives';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function SigninPage() {
  return (
    <div className="min-h-screen bg-background p-4">
      <div className="mx-auto flex min-h-[80vh] max-w-md items-center">
        <div className="w-full space-y-6">
          <PageHeader title="Staff sign in" description="Supabase magic link in production; local workspace mode for development." />
          <Panel title="Employee access">
            <div className="space-y-2">
              <Label htmlFor="email">Work email</Label>
              <Input id="email" type="email" placeholder="name@company.com" />
            </div>
            <Button asChild className="mt-4 w-full"><Link to="/dashboard">Continue to workspace</Link></Button>
            <p className="mt-3 text-xs text-muted-foreground">Production sign-in resolves the active profile row for role and status.</p>
          </Panel>
        </div>
      </div>
    </div>
  );
}
