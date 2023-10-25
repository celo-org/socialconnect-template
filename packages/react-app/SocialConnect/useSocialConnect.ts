import { LookupResponse } from "@/pages/api/socialconnect/lookup";
import { IdentifierPrefix } from "@celo/identity/lib/odis/identifier";
import { useEffect, useState } from "react";
import { useAccount, useWalletClient } from "wagmi";

export const useSocialConnect = () => {
  const { data: walletClient } = useWalletClient();
  const { address } = useAccount();
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState(false);
  const [account, setAccount] = useState<string | null>(null);

  useEffect(() => {
    if (address) {
      setConnected(true);
      setAccount(address);
    } else {
      setConnected(false);
      setAccount(null);
    }
  }, [address]);

  const getIdentifierPrefix = () => {
    if (process.env.NEXT_PUBLIC_SOCIAL_CONNECT_PROVIDER === "TWITTER") {
      return IdentifierPrefix.TWITTER;
    } else if (process.env.NEXT_PUBLIC_SOCIAL_CONNECT_PROVIDER === "GITHUB") {
      return IdentifierPrefix.TWITTER;
    }
    return IdentifierPrefix.TWITTER;
  };

  const lookupAddress = async (identifier: string) => {
    if (walletClient) {
      let response: Response = await fetch(
        `/api/socialconnect/lookup?${new URLSearchParams({
          handle: identifier,
          identifierType: getIdentifierPrefix(),
        })}`,
        {
          method: "GET",
        }
      );

      let lookupResponse: LookupResponse = await response.json();
      if (lookupResponse.accounts.length > 0) {
        return lookupResponse.accounts[0];
      }
    }
  };

  const register = async (identifier: string) => {
    if (walletClient) {
      try {
        setLoading(true);
        let response = await fetch("/api/socialconnect/register", {
          method: "POST",
          body: JSON.stringify({
            account: walletClient?.account.address,
            identifier: identifier,
            identifierType: getIdentifierPrefix(),
          }),
        });

        let registerResponse = await response.json();

        if (registerResponse.error) {
          console.error(registerResponse.error);
          return false;
        }
        return true;
      } catch (error: any) {
        console.error(error.message);
        return false;
      } finally {
        setLoading(false);
      }
    }
  };

  const revoke = async (identifier: string) => {
    if (walletClient) {
      try {
        let response = await fetch("/api/socialconnect/revoke", {
          method: "POST",
          body: JSON.stringify({
            account: walletClient?.account.address,
            identifier: identifier,
            identifierType: getIdentifierPrefix(),
          }),
        });

        let deregisterResponse = await response.json();
        if (deregisterResponse.error) {
          console.error(deregisterResponse.error);
        }
      } catch (error: any) {
        console.error(error.message);
      }
    }
  };

  return {
    loading,
    connected,
    account,
    revoke,
    register,
    lookupAddress,
  };
};
