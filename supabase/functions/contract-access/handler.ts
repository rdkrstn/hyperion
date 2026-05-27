import { handleCors } from '../_shared/cors.ts';
import { ApiError, jsonError, jsonOk, readJson, requireString } from '../_shared/errors.ts';

export type PublicContract = {
  id: string;
  deal_id: string;
  token: string;
  status: string;
  subtotal: number;
  payment_option: string;
  frozen_at: string | null;
  lead_snapshot?: {
    businessName?: string;
    contactName?: string;
    location?: string;
  };
};

export type ContractAccessOps = {
  loadPublicContract: (token: string) => Promise<PublicContract | null>;
  insertAcceptance: (input: { proposal_id: string; token: string; signer_name: string }) => Promise<void>;
  insertInvoice: (input: { deal_id: string; proposal_id: string; amount: number }) => Promise<{ id: string }>;
  markProposalAccepted: (proposalId: string, acceptedAt: string) => Promise<void>;
  markDealAccepted: (dealId: string) => Promise<void>;
  upsertClientFromContract: (contract: PublicContract, signerName: string) => Promise<void>;
};

export function createContractAccessHandler(ops: ContractAccessOps) {
  return async function handleContractAccess(request: Request) {
    const cors = handleCors(request);
    if (cors) return cors;

    try {
      if (request.method === 'GET') {
        const token = requireString(new URL(request.url).searchParams.get('token'), 'token');
        const contract = await ops.loadPublicContract(token);
        if (!contract) throw new ApiError('not_found', 'Contract not found.', 404);
        return jsonOk({ contract });
      }

      if (request.method === 'POST') {
        const body = await readJson<{ token?: string; signerName?: string; signer_name?: string }>(request);
        const token = requireString(body.token, 'token');
        const signerName = requireString(body.signerName ?? body.signer_name, 'signerName');
        const contract = await ops.loadPublicContract(token);
        if (!contract) throw new ApiError('not_found', 'Contract not found.', 404);
        if (contract.status === 'accepted') return jsonOk({ accepted: true, already_signed: true, contract });
        if (contract.status !== 'frozen' || !contract.frozen_at) {
          throw new ApiError('forbidden', 'Only frozen proposals can be accepted.', 403);
        }
        const acceptedAt = new Date().toISOString();
        await ops.insertAcceptance({ proposal_id: contract.id, token, signer_name: signerName });
        const invoice = await ops.insertInvoice({ deal_id: contract.deal_id, proposal_id: contract.id, amount: contract.subtotal });
        await ops.markProposalAccepted(contract.id, acceptedAt);
        await ops.markDealAccepted(contract.deal_id);
        await ops.upsertClientFromContract(contract, signerName);
        return jsonOk({ accepted: true, invoice_id: invoice.id });
      }

      return jsonError(new ApiError('method_not_allowed', 'Method not allowed.', 405));
    } catch (error) {
      return jsonError(error);
    }
  };
}
