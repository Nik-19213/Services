import { ethers } from "ethers";
import { config } from "../config.js";

// Minimal ABI -- only the surface this service actually calls, mirroring the
// pattern used in listener/contract.js for the Messenger demo contract.
const ORGANIZATION_REGISTRY_ABI = [
  "function verifyOrganization(address org, bytes32 jurisdiction, bytes32 kybDocHash, string name) external",
  "function isVerified(address org) view returns (bool)",
];

let organizationRegistry: ethers.Contract | undefined;

// Built lazily, not at import time, so the service can start and run the
// Didit KYB flow before contracts are deployed / chain env vars are set --
// only the functions below need this, and they throw a clear error if called
// too early instead of crashing the whole process at startup.
function getOrganizationRegistry(): ethers.Contract {
  if (organizationRegistry) return organizationRegistry;

  const { rpcUrl, verifierPrivateKey, organizationRegistryAddress } = config.chain;
  if (!rpcUrl || !verifierPrivateKey || !organizationRegistryAddress) {
    throw new Error(
      "On-chain verification is not configured yet -- set BESU_RPC_URL, VERIFIER_PRIVATE_KEY, " +
        "and ORGANIZATION_REGISTRY_ADDRESS in .env once the platform contracts are deployed."
    );
  }

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const verifierWallet = new ethers.Wallet(verifierPrivateKey, provider);
  organizationRegistry = new ethers.Contract(organizationRegistryAddress, ORGANIZATION_REGISTRY_ABI, verifierWallet);
  return organizationRegistry;
}

// Called once a Didit KYB session resolves to Approved. jurisdiction/docHash
// are opaque bytes32 identifiers per OrganizationRegistry's design -- this
// service hashes Didit's own registration-country/session identifiers into
// that shape rather than inventing new semantics for those fields.
export async function verifyOrganizationOnChain(params: {
  orgAddress: string;
  countryCode: string;
  diditSessionId: string;
  companyName: string;
}): Promise<string> {
  const jurisdiction = ethers.keccak256(ethers.toUtf8Bytes(params.countryCode));
  const kybDocHash = ethers.keccak256(ethers.toUtf8Bytes(params.diditSessionId));

  const tx = await getOrganizationRegistry().verifyOrganization(
    params.orgAddress,
    jurisdiction,
    kybDocHash,
    params.companyName
  );
  const receipt = await tx.wait();
  return receipt.hash;
}

export async function isOrganizationVerified(orgAddress: string): Promise<boolean> {
  return getOrganizationRegistry().isVerified(orgAddress);
}
