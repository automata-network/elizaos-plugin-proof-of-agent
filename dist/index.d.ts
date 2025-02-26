import { Plugin } from '@elizaos/core';

interface RequestClaimReq {
    recipient: string;
    assets: string[];
}
interface SubmitClaimReq {
    attestation_report: string;
    context: string;
}
declare class ProofProvider {
    private tdx;
    private sgx;
    private relayUrl;
    private valid;
    constructor(relayUrl: string, sgxMode: string | null, teeMode: string | null);
    isValid(): Promise<boolean>;
    generateAttestation(reportData: string): Promise<string | null>;
    queryAssets(): Promise<any>;
    requestClaim(req: RequestClaimReq): Promise<any>;
    submitClaim(req: SubmitClaimReq): Promise<any>;
}

declare const proofOfAgentPlugin: Plugin;

export { ProofProvider, proofOfAgentPlugin };
