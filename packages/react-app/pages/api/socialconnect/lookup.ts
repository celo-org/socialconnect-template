import { SocialConnectIssuer } from "@/SocialConnect";
import { RPC } from "@/SocialConnect/utils";
import { IdentifierPrefix } from "@celo/identity/lib/odis/identifier";
import { AuthenticationMethod } from "@celo/identity/lib/odis/query";
import { JsonRpcProvider, Wallet } from "ethers";
import type { NextApiRequest, NextApiResponse } from "next";

export type LookupResponse = {
  accounts: string[];
  obfuscatedId: string;
};

export default async function lookup(
  req: NextApiRequest,
  res: NextApiResponse<LookupResponse>
) {
  switch (req.method) {
    case "GET":
      let wallet = new Wallet(
        process.env.ISSUER_PRIVATE_KEY as string,
        new JsonRpcProvider(RPC)
      );

      const issuer = new SocialConnectIssuer(wallet, {
        authenticationMethod: AuthenticationMethod.ENCRYPTION_KEY,
        /**
         * Recommended Authentication method to save ODIS Quota
         *
         * Steps to DEK here: https://github.com/celo-org/social-connect/blob/main/docs/key-setup.md
         */
        rawKey: process.env.DEK_PRIVATE_KEY as string,
      });

      // Based on the type above the Identifier
      const identifier = req.query.handle as string;
      const identifierType = req.query.identifierType as IdentifierPrefix;

      // Addresses of Issuers under which to lookup
      /**
       * In this example, we are looking up addresses under our own issuer.
       * But SocialConnect allows looking up under other issuers just need their address.
       */
      let issuerAddresses = [wallet.address];

      let lookupResponse: LookupResponse = await issuer.lookup(
        identifier,
        identifierType,
        issuerAddresses
      );

      return res.status(200).json(lookupResponse);
    default:
      return res.status(400).json({
        accounts: [],
        obfuscatedId: "",
      });
  }
}
