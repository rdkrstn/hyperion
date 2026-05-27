import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('../../../', import.meta.url));

describe('Syncfusion removal', () => {
  it('does not keep Syncfusion packages or startup helpers', () => {
    const packageJson = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };

    expect(Object.keys(dependencies).some((name) => name.startsWith('@syncfusion/'))).toBe(false);
    expect(existsSync(resolve(root, 'src/lib/syncfusion.ts'))).toBe(false);
  });
});
