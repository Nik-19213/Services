# Innovixus KYB Service

Standalone backend service that runs KYB (Know Your Business) verification
via [Didit](https://didit.me)'s Business Verification product, and — once a
business passes — calls `OrganizationRegistry.verifyOrganization` on the
Innovixus platform contracts so the org can join a pool.

This service is intentionally separate from the Hardhat project: it's a
regular long-running process with its own database, not something deployed
via Ignition.

## Flow

1. Frontend calls `POST /organizations/:orgAddress/kyb` with optional
   `companyName`/`registrationNumber`/`countryCode` hints. This service starts
   a Didit hosted KYB session (`vendor_data` = the org's on-chain address) and
   returns a `verificationUrl` for the frontend to redirect the business to.
2. The business completes Didit's hosted KYB flow (company registry check,
   UBO/key-people verification, document upload, sanctions screening).
3. Didit sends a `status.updated` webhook to `POST /webhooks/didit`. The
   signature (`X-Signature-Simple` + `X-Timestamp`) is verified before
   anything is processed.
4. If the terminal status is `Approved`, this service fetches the full
   decision (`GET /session/{id}/decision/`) to pull the verified company name
   and registration country, then signs and sends
   `verifyOrganization(org, jurisdiction, kybDocHash, name)` on-chain using a
   configured `VERIFIER_PRIVATE_KEY` (an address that must hold
   `VERIFIER_ROLE` on `OrganizationRegistry`).
5. `GET /organizations/:orgAddress/kyb` returns the full session history for
   that org, including `onChainTxHash` once verification lands.

Every step is idempotent — a retried webhook or a duplicate manual re-check
never sends a second on-chain transaction for the same session
(`onChainTxHash` guards it).

## Setup

```shell
cd kyb-service
npm install
cp .env.example .env   # fill in DIDIT_API_KEY, DIDIT_KYB_WORKFLOW_ID,
                        # DIDIT_WEBHOOK_SECRET, VERIFIER_PRIVATE_KEY,
                        # ORGANIZATION_REGISTRY_ADDRESS, etc.
npx prisma migrate dev --name init
npm run dev
```

`VERIFIER_PRIVATE_KEY` must belong to an address that already holds
`VERIFIER_ROLE` on the deployed `OrganizationRegistry` — grant it via
`OrganizationRegistry.grantRole(VERIFIER_ROLE, <this-service's-address>)` from
your platform admin account after deploying the platform.

## Didit dashboard setup (one-time)

1. Create an Application (sandbox first) — this gives you `DIDIT_API_KEY`.
2. Configure a **Business Verification (KYB)** workflow — this gives you
   `DIDIT_KYB_WORKFLOW_ID`. Do not use a KYC/individual workflow ID here.
3. Create a webhook destination pointing at this service's public
   `/webhooks/didit` URL — this gives you `DIDIT_WEBHOOK_SECRET`
   (`secret_shared_key`), shown only once.

## Notes / known limitations

- Didit's `verifyOrganization` call uses `keccak256(countryCode)` as the
  `jurisdiction` bytes32 and `keccak256(sessionId)` as `kybDocHash` — these are
  opaque identifiers per `OrganizationRegistry`'s design, not meant to be
  reversed on-chain; the full Didit decision payload (company details, UBO
  checks, AML screening) is kept in this service's own database
  (`KybSession.decision`) as the actual audit record.
- This service only calls `verifyOrganization`. It never calls
  `suspendOrganization`/`revokeOrganization` — those remain manual actions by
  platform compliance staff, since a Didit KYB pass/fail isn't the same
  determination as an ongoing-suspicion suspension.
- A couple of Didit's raw JSON field names (the create-session redirect URL,
  `expected_details` sub-fields) weren't independently confirmed against a
  live response at the time this was written — `src/didit/client.ts` handles
  both plausible spellings for the redirect URL defensively. Verify against a
  real sandbox response before going to production.
