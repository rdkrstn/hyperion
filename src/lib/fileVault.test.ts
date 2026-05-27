import { describe, expect, it } from 'vitest';
import { seedDeals } from '../data/seed';
import {
  buildDealFile,
  createSignedDownloadUrl,
  fileRequirementStatus,
  rejectDealFile,
  validateDealFile,
} from './fileVault';

describe('deal file vault', () => {
  it('keeps uploaded files pending until CS or owner validates them', () => {
    const file = buildDealFile({
      dealId: seedDeals[1].id,
      category: 'valid_id',
      fileName: 'id.jpg',
      mimeType: 'image/jpeg',
      uploadedByRole: 'sales',
    });

    expect(file.validationStatus).toBe('pending_validation');
    expect(fileRequirementStatus([file], 'valid_id').satisfied).toBe(false);

    const validated = validateDealFile(file, 'cs');

    expect(validated.validationStatus).toBe('validated');
    expect(fileRequirementStatus([validated], 'valid_id').satisfied).toBe(true);
  });

  it('rejects non-CS/non-owner validation and exposes signed download metadata only', () => {
    const file = buildDealFile({
      dealId: seedDeals[1].id,
      category: 'customer_bill',
      fileName: 'bill.pdf',
      mimeType: 'application/pdf',
      uploadedByRole: 'sales',
      storagePath: 'deal-files/deal-1/customer_bill/bill.pdf',
    });

    expect(() => validateDealFile(file, 'sales')).toThrow(/CS or owner/i);

    const rejected = rejectDealFile(file, 'owner', 'Unreadable scan.');
    const url = createSignedDownloadUrl(rejected, 'https://storage.local/sign');

    expect(rejected.validationStatus).toBe('rejected');
    expect(url).toContain(encodeURIComponent(file.storagePath));
  });
});
