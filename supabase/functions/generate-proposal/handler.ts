import { handleCors } from '../_shared/cors.ts';
import { ApiError, jsonError, jsonOk, readJson, requireNumber, requireString } from '../_shared/errors.ts';

export type GenerateProposalOps = {
  generateProposal: (input: { dealId: string; packageTemplate: string; systemSizeKwp: number; paymentOption: string; pricingInputs: unknown }) => Promise<{ proposal_id: string; status: 'frozen' | 'draft'; subtotal: number; gross_margin_percent: number }>;
};

export function createGenerateProposalHandler(ops: GenerateProposalOps) {
  return async function handleGenerateProposal(request: Request) {
    const cors = handleCors(request);
    if (cors) return cors;
    if (request.method !== 'POST') return jsonError(new ApiError('method_not_allowed', 'Method not allowed.', 405));
    try {
      const input = await readJson<{ deal_id?: string; dealId?: string; package_template?: string; packageTemplate?: string; system_size_kwp?: number; systemSizeKwp?: number; payment_option?: string; paymentOption?: string; pricingInputs?: unknown; pricing_inputs?: unknown }>(request);
      return jsonOk(await ops.generateProposal({
        dealId: requireString(input.deal_id ?? input.dealId, 'deal_id'),
        packageTemplate: String(input.package_template ?? input.packageTemplate ?? 'standard_solar_scope'),
        systemSizeKwp: requireNumber(input.system_size_kwp ?? input.systemSizeKwp, 'system_size_kwp'),
        paymentOption: String(input.payment_option ?? input.paymentOption ?? 'cash'),
        pricingInputs: input.pricingInputs ?? input.pricing_inputs ?? {},
      }));
    } catch (error) {
      return jsonError(error);
    }
  };
}
