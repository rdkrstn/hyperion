import type { ActionResult } from '../types';

export function success<T = unknown>(message: string, data?: T): ActionResult<T> {
  return { ok: true, message, data };
}

export function failure<T = unknown>(error: string, data?: T): ActionResult<T> {
  return { ok: false, error, data };
}

export function normalizeActionResult<T>(result: ActionResult<T> | T | void, fallbackMessage: string): ActionResult<T> {
  if (result && typeof result === 'object' && 'ok' in result) return result as ActionResult<T>;
  return success(fallbackMessage, result as T);
}

export function actionKey(action: string, id = 'global') {
  return `${action}:${id}`;
}

export function createActionLock() {
  const inFlight = new Set<string>();

  async function run<T>(key: string, operation: () => Promise<ActionResult<T>> | ActionResult<T>): Promise<ActionResult<T>> {
    if (inFlight.has(key)) return failure(`Action is already processing: ${key}`);
    inFlight.add(key);
    try {
      return await operation();
    } catch (error) {
      return failure(error instanceof Error ? error.message : 'Action failed.');
    } finally {
      inFlight.delete(key);
    }
  }

  function isPending(key: string) {
    return inFlight.has(key);
  }

  return { run, isPending };
}
