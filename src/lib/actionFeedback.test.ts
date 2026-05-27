import { describe, expect, it } from 'vitest';
import { createActionLock, failure, success } from './actionFeedback';

describe('action feedback and duplicate guards', () => {
  it('normalizes successful and failed operation results', () => {
    expect(success('Saved.')).toMatchObject({ ok: true, message: 'Saved.' });
    expect(failure('Blocked.')).toMatchObject({ ok: false, error: 'Blocked.' });
  });

  it('blocks duplicate work while the same action key is running', async () => {
    const lock = createActionLock();
    let duplicateError = '';

    const result = await lock.run('lead-1:assign-survey', async () => {
      const duplicate = await lock.run('lead-1:assign-survey', async () => success('Should not run.'));
      duplicateError = duplicate.error ?? '';
      return success('Survey assigned.');
    });

    expect(result.ok).toBe(true);
    expect(duplicateError).toContain('already processing');
  });
});
