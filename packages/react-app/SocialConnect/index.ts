import { OdisUtils } from "@celo/identity";
import { IdentifierPrefix } from "@celo/identity/lib/odis/identifier";
import { AuthSigner, ServiceContext } from "@celo/identity/lib/odis/query";
import { Contract, Wallet } from "ethers";
import { parseEther } from "viem";
import {
  FA_CONTRACT,
  FA_PROXY_ADDRESS,
  ODIS_PAYMENTS_CONTRACT,
  ODIS_PAYMENTS_PROXY_ADDRESS,
  SERVICE_CONTEXT,
  STABLE_TOKEN_ADDRESS,
  STABLE_TOKEN_CONTRACT,
} from "./utils";

export const ONE_CENT_CUSD = parseEther("0.01");

export const NOW_TIMESTAMP = Math.floor(new Date().getTime() / 1000);

export class SocialConnectIssuer {
  private readonly federatedAttestationsContract: Contract;
  private readonly odisPaymentsContract: Contract;
  private readonly stableTokenContract: Contract;
  readonly serviceContext: ServiceContext;

  constructor(
    private readonly wallet: Wallet,
    private readonly authSigner: AuthSigner
  ) {
    this.serviceContext = OdisUtils.Query.getServiceContext(SERVICE_CONTEXT);
    this.federatedAttestationsContract = new Contract(
      FA_PROXY_ADDRESS,
      FA_CONTRACT.abi,
      this.wallet
    );
    this.odisPaymentsContract = new Contract(
      ODIS_PAYMENTS_PROXY_ADDRESS,
      ODIS_PAYMENTS_CONTRACT.abi,
      this.wallet
    );
    this.stableTokenContract = new Contract(
      STABLE_TOKEN_ADDRESS,
      STABLE_TOKEN_CONTRACT.abi,
      this.wallet
    );
  }

  async getObfuscatedId(plaintextId: string, identifierType: IdentifierPrefix) {
    // TODO look into client side blinding
    const { obfuscatedIdentifier } =
      await OdisUtils.Identifier.getObfuscatedIdentifier(
        plaintextId,
        identifierType,
        this.wallet.address,
        this.authSigner,
        this.serviceContext
      );
    return obfuscatedIdentifier;
  }

  async checkAndTopUpODISQuota() {
    const remainingQuota = await this.checkODISQuota();

    if (remainingQuota < 1) {
      // TODO make threshold a constant
      const approvalTxReceipt = (
        await this.stableTokenContract.increaseAllowance(
          this.odisPaymentsContract.address,
          ONE_CENT_CUSD // TODO we should increase by more
        )
      ).wait();
      const odisPaymentTxReceipt = (
        await this.odisPaymentsContract.payInCUSD(
          this.wallet.address,
          ONE_CENT_CUSD // TODO we should increase by more
        )
      ).wait();
    }
  }

  async getObfuscatedIdWithQuotaRetry(
    plaintextId: string,
    identifierType: IdentifierPrefix
  ) {
    try {
      return this.getObfuscatedId(plaintextId, identifierType);
    } catch {
      await this.checkAndTopUpODISQuota();
      return this.getObfuscatedId(plaintextId, identifierType);
    }
  }

  async registerOnChainIdentifier(
    plaintextId: string,
    identifierType: IdentifierPrefix,
    address: string
  ) {
    const obfuscatedId = await this.getObfuscatedIdWithQuotaRetry(
      plaintextId,
      identifierType
    );

    const tx =
      await this.federatedAttestationsContract.registerAttestationAsIssuer(
        // TODO check if there are better code patterns for sending txs
        obfuscatedId,
        address,
        NOW_TIMESTAMP
      );
    const receipt = await tx.wait();
    return receipt;
  }

  async deregisterOnChainIdentifier(
    plaintextId: string,
    identifierType: IdentifierPrefix,
    address: string
  ) {
    const obfuscatedId = await this.getObfuscatedIdWithQuotaRetry(
      plaintextId,
      identifierType
    );
    const tx = await this.federatedAttestationsContract.revokeAttestation(
      obfuscatedId,
      this.wallet.address,
      address
    );
    const receipt = await tx.wait();
    return receipt;
  }

  async checkODISQuota() {
    const { remainingQuota } = await OdisUtils.Quota.getPnpQuotaStatus(
      this.wallet.address,
      this.authSigner,
      this.serviceContext
    );
    console.log("Remaining Quota", remainingQuota);
    return remainingQuota;
  }

  async lookup(
    plaintextId: string,
    identifierType: IdentifierPrefix,
    issuerAddresses: string[]
  ) {
    const obfuscatedId = await this.getObfuscatedId(
      plaintextId,
      identifierType
    );
    const attestations =
      await this.federatedAttestationsContract.lookupAttestations(
        await this.getObfuscatedIdWithQuotaRetry(plaintextId, identifierType),
        issuerAddresses
      );

    return {
      accounts: attestations.accounts as string[], // TODO typesafety
      obfuscatedId,
    };
  }
}