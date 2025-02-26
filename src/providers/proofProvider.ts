import {
    IAgentRuntime,
    Memory,
    Provider,
    State,
    elizaLogger,
} from "@elizaos/core";

import { RemoteAttestationProvider, TEEMode } from "@elizaos/plugin-tee";
import { SgxAttestationProvider } from "@elizaos/plugin-sgx";
import { send_rpc_request } from "@phala/dstack-sdk";
import { createHash } from 'crypto';

export function to_hex(data: string | Buffer | Uint8Array): string {
    if (typeof data === 'string') {
        return Buffer.from(data).toString('hex');
    }
    if (data instanceof Uint8Array) {
        return Buffer.from(data).toString('hex');
    }
    return (data as Buffer).toString('hex');
}

export interface RequestClaimReq {
    recipient: string,
    assets: string[],
}

export interface SubmitClaimReq {
    attestation_report: string,
    context: string,
}

class ProofProvider {
    private tdx: RemoteAttestationProvider | null = null;
    private sgx: SgxAttestationProvider | null = null;
    private relayUrl: string;
    private valid: boolean = false;

    constructor(relayUrl: string, sgxMode: string | null, teeMode: string | null) {
        if (teeMode && teeMode != TEEMode.OFF) {
            this.tdx = new RemoteAttestationProvider(teeMode);
            this.valid = true;
        } else if (sgxMode) {
            this.sgx = new SgxAttestationProvider();
            this.valid = true;
        }
        this.relayUrl = relayUrl;
    }

    async isValid() {
        return this.valid;
    }

    async generateAttestation(reportData: string) {
        elizaLogger.log("poa-generateAttestation:", reportData);
        if (this.tdx) {
            const report = await this.tdx.generateAttestation(reportData, 'sha256');
            return report.quote;
        } else if (this.sgx) {
            const report = await this.sgx.generateAttestation(reportData);
            return report.quote;
        } else {
            return null;
        }
    }

    async queryAssets() {
        const response = await send_rpc_request(this.relayUrl, "/poa/queryAssets", `{}`);
        return response;
    }

    async requestClaim(req: RequestClaimReq) {
        const response = await send_rpc_request(this.relayUrl, "/poa/requestClaim", JSON.stringify(req));
        return response;
    }

    async submitClaim(req: SubmitClaimReq) {
        const response = await send_rpc_request(this.relayUrl, "/poa/submitClaim", JSON.stringify(req));
        return response;
    }
}

function hexToUint8Array(hex: string) {
    hex = hex.trim();
    if (!hex) {
      throw new Error("Invalid hex string");
    }
    if (hex.startsWith("0x")) {
      hex = hex.substring(2);
    }
    if (hex.length % 2 !== 0) {
      throw new Error("Invalid hex string");
    }

    const array = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
      const byte = parseInt(hex.slice(i, i + 2), 16);
      if (isNaN(byte)) {
        throw new Error("Invalid hex string");
      }
      array[i / 2] = byte;
    }
    return array;
}

export { ProofProvider };