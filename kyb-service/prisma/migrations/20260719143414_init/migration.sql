-- CreateTable
CREATE TABLE "Organization" (
    "address" TEXT NOT NULL,
    "name" TEXT,
    "jurisdiction" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("address")
);

-- CreateTable
CREATE TABLE "KybSession" (
    "id" TEXT NOT NULL,
    "orgAddress" TEXT NOT NULL,
    "diditSessionId" TEXT NOT NULL,
    "diditWorkflowId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Not Started',
    "decision" JSONB,
    "verificationUrl" TEXT,
    "onChainTxHash" TEXT,
    "onChainVerifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KybSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "KybSession_diditSessionId_key" ON "KybSession"("diditSessionId");

-- CreateIndex
CREATE INDEX "KybSession_orgAddress_idx" ON "KybSession"("orgAddress");

-- CreateIndex
CREATE INDEX "KybSession_status_idx" ON "KybSession"("status");

-- AddForeignKey
ALTER TABLE "KybSession" ADD CONSTRAINT "KybSession_orgAddress_fkey" FOREIGN KEY ("orgAddress") REFERENCES "Organization"("address") ON DELETE RESTRICT ON UPDATE CASCADE;
