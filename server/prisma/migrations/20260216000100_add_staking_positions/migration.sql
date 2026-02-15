-- CreateTable
CREATE TABLE "StakingPosition" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "amount" DECIMAL(20,8) NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StakingPosition_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StakingPosition_userId_idx" ON "StakingPosition"("userId");

-- CreateIndex
CREATE INDEX "StakingPosition_endAt_idx" ON "StakingPosition"("endAt");

-- AddForeignKey
ALTER TABLE "StakingPosition" ADD CONSTRAINT "StakingPosition_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
