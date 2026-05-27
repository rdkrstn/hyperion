import type { InstallerRoutePlan } from '../../../src/types.ts';

export type InstallerRoutePlanOps = {
  buildRoutePlan: (input: { installerId: string; origin?: { latitude?: number; longitude?: number } }) => Promise<InstallerRoutePlan>;
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

export function createInstallerRoutePlanHandler(ops: InstallerRoutePlanOps) {
  return async function handleInstallerRoutePlan(request: Request) {
    try {
      if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
      const input = await request.json() as { installerId?: string; origin?: { latitude?: number; longitude?: number } };
      if (!input.installerId?.trim()) return json({ error: 'installerId is required.' }, 400);
      return json(await ops.buildRoutePlan({ installerId: input.installerId, origin: input.origin }));
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : 'Unknown installer route plan error.' }, 500);
    }
  };
}
