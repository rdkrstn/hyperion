import { handleCors } from '../_shared/cors.ts';
import { ApiError, jsonError, jsonOk, readJson, requireNumber, requireString } from '../_shared/errors.ts';

export type LeadIntakeInput = {
  name?: string;
  businessName?: string;
  contactName?: string;
  phone?: string;
  email?: string;
  location?: string;
  monthlyBillEstimate?: number;
  averageMonthlyBill?: number;
  monthlyKwh?: number;
  goal?: string;
  businessPropertyType?: string;
  businessType?: string;
  source?: string;
  paymentPreference?: string;
};

export type LeadIntakeOps = {
  createLead: (input: {
    businessName: string;
    contactName: string;
    phone?: string;
    email?: string;
    location: string;
    monthlyBillEstimate: number;
    monthlyKwh?: number;
    goal: string;
    businessPropertyType: string;
    source: string;
    paymentPreference: string;
  }) => Promise<{ lead_id: string }>;
};

export function createLeadIntakeHandler(ops: LeadIntakeOps) {
  return async function handleLeadIntake(request: Request) {
    const cors = handleCors(request);
    if (cors) return cors;
    if (request.method !== 'POST') return jsonError(new ApiError('method_not_allowed', 'Method not allowed.', 405));

    try {
      const input = await readJson<LeadIntakeInput>(request);
      const phone = typeof input.phone === 'string' ? input.phone.trim() : undefined;
      const email = typeof input.email === 'string' ? input.email.trim() : undefined;
      if (!phone && !email) throw new ApiError('bad_request', 'Phone or email is required.');
      const monthlyKwh = typeof input.monthlyKwh === 'number' && Number.isFinite(input.monthlyKwh) && input.monthlyKwh > 0
        ? Math.round(input.monthlyKwh)
        : undefined;
      const providedMonthlyBill = input.monthlyBillEstimate ?? input.averageMonthlyBill;
      const monthlyBillEstimate = typeof providedMonthlyBill === 'number' && Number.isFinite(providedMonthlyBill) && providedMonthlyBill > 0
        ? Math.round(providedMonthlyBill)
        : monthlyKwh
          ? Math.round(monthlyKwh * 11)
          : requireNumber(providedMonthlyBill, 'monthlyBillEstimate');

      const result = await ops.createLead({
        businessName: requireString(input.businessName ?? input.name, 'name'),
        contactName: requireString(input.contactName ?? input.name, 'contactName'),
        phone,
        email,
        location: requireString(input.location, 'location'),
        monthlyBillEstimate,
        monthlyKwh,
        goal: requireString(input.goal, 'goal'),
        businessPropertyType: requireString(input.businessPropertyType ?? input.businessType ?? 'commercial', 'businessPropertyType'),
        source: String(input.source ?? 'public_inquiry'),
        paymentPreference: String(input.paymentPreference ?? 'loan'),
      });
      return jsonOk(result);
    } catch (error) {
      return jsonError(error);
    }
  };
}
