import { SocialConnectIssuer } from "@/SocialConnect";
import { RPC } from "@/SocialConnect/utils";
import { AuthenticationMethod } from "@celo/identity/lib/odis/query";
import { JsonRpcProvider, Wallet } from "ethers";
import { NextApiRequest, NextApiResponse } from "next";

export type RegisterResponse =
  | {
      receipt: string;
    }
  | {
      error: string;
    };

export default async function revoke(
  req: NextApiRequest,
  res: NextApiResponse<RegisterResponse>
) {
  switch (req.method) {
    case "POST":
      let { identifier, account, identifierType } = JSON.parse(req.body);

      let wallet = new Wallet(
        process.env.ISSUER_PRIVATE_KEY as string,
        new JsonRpcProvider(RPC)
      );

      const issuer = new SocialConnectIssuer(wallet, {
        authenticationMethod: AuthenticationMethod.ENCRYPTION_KEY,
        rawKey: process.env.DEK_PRIVATE_KEY as string,
      });

      let deregisterResponse: string = await issuer.deregisterOnChainIdentifier(
        identifier,
        identifierType,
        account as string
      );

      return res.status(200).json({ receipt: deregisterResponse });

    default:
      return res.status(400).json({
        error: "Method not supported",
      });
  }
}
