import { prisma } from "../db.js";
import { createKybSession, getSessionDecision } from "../didit/client.js";
import { verifyOrganizationOnChain } from "../chain/organizationRegistry.js";
import type { DiditSessionStatus } from "../didit/types.js";

export async function startKyb(params: {
  orgAddress: string;
  companyName?: string;
  registrationNumber?: string;
  countryCode?: string;
}) {
  const orgAddress = params.orgAddress.toLowerCase();

  await prisma.organization.upsert({
    where: { address: orgAddress },
    create: { address: orgAddress, name: params.companyName, jurisdiction: params.countryCode },
    update: { name: params.companyName ?? undefined, jurisdiction: params.countryCode ?? undefined },
  });

  const { sessionId, verificationUrl } = await createKybSession(params);

  await prisma.kybSession.create({
    data: {
      orgAddress,
      diditSessionId: sessionId,
      diditWorkflowId: process.env.DIDIT_KYB_WORKFLOW_ID ?? "",
      verificationUrl,
      status: "Not Started",
    },
  });

  return { sessionId, verificationUrl };
}

export async function getKybStatus(orgAddress: string) {
  return prisma.kybSession.findMany({
    where: { orgAddress: orgAddress.toLowerCase() },
    orderBy: { createdAt: "desc" },
  });
}

// Idempotent: safe to call more than once for the same session (e.g. a
// retried webhook, or a manual re-sync via the decision endpoint) -- it only
// submits the on-chain transaction the first time a session is confirmed
// Approved (onChainTxHash stays null until then).
export async function processSessionUpdate(sessionId: string, status: DiditSessionStatus) {
  const session = await prisma.kybSession.findUnique({ where: { diditSessionId: sessionId } });
  if (!session) {
    throw new Error(`No local KYB session found for Didit session_id ${sessionId}`);
  }

  await prisma.kybSession.update({
    where: { diditSessionId: sessionId },
    data: { status },
  });

  if (status !== "Approved" || session.onChainTxHash) {
    return { verifiedOnChain: false };
  }

  const decision = await getSessionDecision(sessionId);
  const company = decision.registry_checks?.[0]?.company;
  if (!company) {
    throw new Error(`Session ${sessionId} is Approved but its decision has no registry_checks[0].company to verify with`);
  }

  const txHash = await verifyOrganizationOnChain({
    orgAddress: session.orgAddress,
    countryCode: company.country_code,
    diditSessionId: sessionId,
    companyName: company.company_name,
  });

  await prisma.kybSession.update({
    where: { diditSessionId: sessionId },
    data: { decision: decision as any, onChainTxHash: txHash, onChainVerifiedAt: new Date() },
  });

  return { verifiedOnChain: true, txHash };
}
