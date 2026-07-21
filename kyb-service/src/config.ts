import "dotenv/config";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable ${name}`);
  return value;
}

export const config = {
  port: Number(process.env.PORT ?? 4100),

  didit: {
    apiKey: requireEnv("DIDIT_API_KEY"),
    kybWorkflowId: requireEnv("DIDIT_KYB_WORKFLOW_ID"),
    webhookSecret: requireEnv("DIDIT_WEBHOOK_SECRET"),
    callbackUrl: requireEnv("DIDIT_CALLBACK_URL"),
    baseUrl: "https://verification.didit.me/v3",
  },

  // Optional at startup -- contracts may not be deployed yet. Left unset,
  // the Didit KYB flow (start session, receive webhook, store decision)
  // still works; only the final on-chain verifyOrganization call fails,
  // with a clear error, until these are filled in.
  chain: {
    rpcUrl: process.env.BESU_RPC_URL,
    verifierPrivateKey: process.env.VERIFIER_PRIVATE_KEY,
    organizationRegistryAddress: process.env.ORGANIZATION_REGISTRY_ADDRESS,
  },
};
