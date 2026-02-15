-- CreateTable
CREATE TABLE "SocialTournamentMatchResult" (
    "id" SERIAL NOT NULL,
    "matchId" TEXT NOT NULL,
    "winners" JSONB NOT NULL,
    "scores" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SocialTournamentMatchResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SocialTournamentMatchResult_matchId_key" ON "SocialTournamentMatchResult"("matchId");
