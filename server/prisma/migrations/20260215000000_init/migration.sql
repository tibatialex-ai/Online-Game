-- Create enums
CREATE TYPE "SubscriptionTier" AS ENUM ('TIER_30', 'TIER_60', 'TIER_100');
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'CANCELED');

-- Create tables
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "nickname" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "refCode" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gameRating" INTEGER NOT NULL DEFAULT 0,
    "mlmRating" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Referral" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "inviterId" INTEGER NOT NULL,
    "level" INTEGER NOT NULL,
    CONSTRAINT "Referral_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Referral_level_check" CHECK ("level" BETWEEN 1 AND 5)
);

CREATE TABLE "Subscription" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "tier" "SubscriptionTier" NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "status" "SubscriptionStatus" NOT NULL,
    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Wallet" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "balanceToken" DECIMAL(20,8) NOT NULL DEFAULT 0,
    "lockedToken" DECIMAL(20,8) NOT NULL DEFAULT 0,
    "stakedToken" DECIMAL(20,8) NOT NULL DEFAULT 0,
    CONSTRAINT "Wallet_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Ledger" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "amount" DECIMAL(20,8) NOT NULL,
    "metaJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Ledger_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Treasury" (
    "id" INTEGER NOT NULL,
    "balanceToken" DECIMAL(20,8) NOT NULL DEFAULT 0,
    CONSTRAINT "Treasury_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Treasury_singleton_check" CHECK ("id" = 1)
);

-- Indexes
CREATE UNIQUE INDEX "User_nickname_key" ON "User"("nickname");
CREATE INDEX "Referral_userId_idx" ON "Referral"("userId");
CREATE INDEX "Referral_inviterId_idx" ON "Referral"("inviterId");
CREATE INDEX "Subscription_userId_idx" ON "Subscription"("userId");
CREATE UNIQUE INDEX "Wallet_userId_key" ON "Wallet"("userId");
CREATE INDEX "Ledger_userId_idx" ON "Ledger"("userId");

-- FKs
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_inviterId_fkey" FOREIGN KEY ("inviterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Ledger" ADD CONSTRAINT "Ledger_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Seed singleton treasury row
INSERT INTO "Treasury" ("id", "balanceToken") VALUES (1, 0)
ON CONFLICT ("id") DO NOTHING;
