import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Socket } from 'net';

const PLAYERS_PER_MATCH = 10;
const REDIS_MATCH_KEY_PREFIX = 'social_tournament:match:';

export type SocialTournamentRoundType =
  | 'logic'
  | 'group_voting'
  | 'personal_choice'
  | 'social_voting';

export interface SocialTournamentRound {
  roundNumber: number;
  type: SocialTournamentRoundType;
  answers: Record<string, string | number>;
  resolved: boolean;
  details: {
    correctOption?: number;
    beneficialChoice?: 'A' | 'B';
    winningOption?: number;
  };
}

export interface SocialTournamentMatch {
  id: string;
  playerIds: number[];
  durationMinutes: number;
  createdAt: string;
  updatedAt: string;
  completed: boolean;
  currentRoundIndex: number;
  scores: Record<string, number>;
  rounds: SocialTournamentRound[];
}

interface RedisEndpoint {
  host: string;
  port: number;
}

@Injectable()
export class SocialTournamentService {
  private readonly matches = new Map<string, SocialTournamentMatch>();
  private readonly redisEndpoint: RedisEndpoint;

  constructor() {
    this.redisEndpoint = this.parseRedisEndpoint(process.env.REDIS_URL ?? 'redis://127.0.0.1:6379');
  }

  private parseRedisEndpoint(url: string): RedisEndpoint {
    try {
      const parsed = new URL(url);
      return {
        host: parsed.hostname || '127.0.0.1',
        port: parsed.port ? Number(parsed.port) : 6379,
      };
    } catch (error) {
      throw new InternalServerErrorException('REDIS_URL is invalid');
    }
  }

  private async sendRedisCommand(args: string[]): Promise<string | null> {
    const payload = this.encodeRespArray(args);

    return new Promise((resolve, reject) => {
      const socket = new Socket();
      const chunks: Buffer[] = [];

      socket.setTimeout(2000);

      socket.on('data', (chunk) => {
        chunks.push(chunk);
      });

      socket.on('end', () => {
        try {
          const response = Buffer.concat(chunks).toString('utf8');
          resolve(this.decodeResp(response));
        } catch (error) {
          reject(error);
        }
      });

      socket.on('timeout', () => {
        socket.destroy();
        reject(new InternalServerErrorException('Redis request timeout'));
      });

      socket.on('error', () => {
        reject(new InternalServerErrorException('Redis connection failed'));
      });

      socket.connect(this.redisEndpoint.port, this.redisEndpoint.host, () => {
        socket.write(payload);
        socket.end();
      });
    });
  }

  private encodeRespArray(args: string[]) {
    const segments = [`*${args.length}\r\n`];
    for (const arg of args) {
      const value = Buffer.from(arg, 'utf8');
      segments.push(`$${value.length}\r\n${arg}\r\n`);
    }

    return segments.join('');
  }

  private decodeResp(raw: string): string | null {
    if (!raw) {
      throw new InternalServerErrorException('Empty Redis response');
    }

    const marker = raw[0];

    if (marker === '+') {
      return raw.slice(1).trim();
    }

    if (marker === '$') {
      const firstCrlf = raw.indexOf('\r\n');
      const length = Number(raw.slice(1, firstCrlf));
      if (length === -1) {
        return null;
      }

      const start = firstCrlf + 2;
      return raw.slice(start, start + length);
    }

    if (marker === '-') {
      throw new InternalServerErrorException(`Redis error: ${raw.slice(1).trim()}`);
    }

    throw new InternalServerErrorException('Unsupported Redis response');
  }

  private buildMatchKey(matchId: string) {
    return `${REDIS_MATCH_KEY_PREFIX}${matchId}`;
  }

  private roundTypes(): SocialTournamentRoundType[] {
    return ['logic', 'group_voting', 'personal_choice', 'logic', 'social_voting'];
  }

  private randomOptionFromFour() {
    return Math.floor(Math.random() * 4);
  }

  private randomAB(): 'A' | 'B' {
    return Math.random() >= 0.5 ? 'A' : 'B';
  }

  private buildRounds(): SocialTournamentRound[] {
    return this.roundTypes().map((type, index) => {
      const round: SocialTournamentRound = {
        roundNumber: index + 1,
        type,
        answers: {},
        resolved: false,
        details: {},
      };

      if (type === 'logic') {
        round.details.correctOption = this.randomOptionFromFour();
      }

      if (type === 'personal_choice') {
        round.details.beneficialChoice = this.randomAB();
      }

      return round;
    });
  }

  private async persistMatch(match: SocialTournamentMatch) {
    const payload = JSON.stringify(match);

    try {
      const response = await this.sendRedisCommand(['SET', this.buildMatchKey(match.id), payload]);
      if (response !== 'OK') {
        throw new InternalServerErrorException('Redis SET failed');
      }
    } catch (error) {
      throw new InternalServerErrorException('Failed to persist match in Redis');
    }

    this.matches.set(match.id, match);
  }

  private async loadMatch(matchId: string): Promise<SocialTournamentMatch> {
    const memoryMatch = this.matches.get(matchId);
    if (memoryMatch) {
      return memoryMatch;
    }

    try {
      const raw = await this.sendRedisCommand(['GET', this.buildMatchKey(matchId)]);
      if (!raw) {
        throw new NotFoundException('Match not found');
      }

      const restoredMatch = JSON.parse(raw) as SocialTournamentMatch;
      this.matches.set(matchId, restoredMatch);
      return restoredMatch;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      throw new InternalServerErrorException('Failed to load match from Redis');
    }
  }

  private ensurePlayers(players: number[]) {
    if (!Array.isArray(players) || players.length !== PLAYERS_PER_MATCH) {
      throw new BadRequestException(`Match must contain exactly ${PLAYERS_PER_MATCH} players`);
    }

    const unique = new Set(players);
    if (unique.size !== PLAYERS_PER_MATCH) {
      throw new BadRequestException('Players must be unique');
    }

    for (const playerId of players) {
      if (!Number.isInteger(playerId) || playerId <= 0) {
        throw new BadRequestException('Every playerId must be a positive integer');
      }
    }
  }

  private resolveRound(match: SocialTournamentMatch, round: SocialTournamentRound) {
    if (round.resolved) {
      return;
    }

    const playerAnswers = round.answers;

    if (round.type === 'logic') {
      const correct = round.details.correctOption;
      if (typeof correct !== 'number') {
        throw new InternalServerErrorException('Logic round is not configured');
      }

      for (const playerId of match.playerIds) {
        const answer = playerAnswers[playerId.toString()];
        if (typeof answer === 'number' && answer === correct) {
          match.scores[playerId.toString()] += 2;
        }
      }
    }

    if (round.type === 'group_voting') {
      const votesByOption = new Map<number, number>();

      for (const answer of Object.values(playerAnswers)) {
        if (typeof answer === 'number') {
          votesByOption.set(answer, (votesByOption.get(answer) ?? 0) + 1);
        }
      }

      let winningOption = 0;
      let winningVotes = -1;

      for (const [option, votes] of votesByOption.entries()) {
        if (votes > winningVotes || (votes === winningVotes && option < winningOption)) {
          winningVotes = votes;
          winningOption = option;
        }
      }

      round.details.winningOption = winningOption;

      for (const playerId of match.playerIds) {
        const answer = playerAnswers[playerId.toString()];
        if (typeof answer === 'number' && answer === winningOption) {
          match.scores[playerId.toString()] += 2;
        }
      }
    }

    if (round.type === 'personal_choice') {
      const beneficial = round.details.beneficialChoice;
      if (beneficial !== 'A' && beneficial !== 'B') {
        throw new InternalServerErrorException('Personal choice round is not configured');
      }

      for (const playerId of match.playerIds) {
        const answer = playerAnswers[playerId.toString()];
        if (answer === beneficial) {
          match.scores[playerId.toString()] += 2;
        }
      }
    }

    if (round.type === 'social_voting') {
      for (const answer of Object.values(playerAnswers)) {
        if (typeof answer === 'number') {
          const target = answer.toString();
          if (typeof match.scores[target] === 'number') {
            match.scores[target] += 1;
          }
        }
      }
    }

    round.resolved = true;
    match.currentRoundIndex += 1;
    if (match.currentRoundIndex >= match.rounds.length) {
      match.completed = true;
    }
  }

  private validateAndNormalizeRoundAnswer(
    round: SocialTournamentRound,
    playerId: number,
    answer: string | number,
    playerIds: number[],
  ): string | number {
    if (round.type === 'logic' || round.type === 'group_voting') {
      const numericAnswer = typeof answer === 'string' ? Number(answer) : answer;
      if (!Number.isInteger(numericAnswer) || numericAnswer < 0 || numericAnswer > 3) {
        throw new BadRequestException('Answer must be an integer from 0 to 3');
      }

      return numericAnswer;
    }

    if (round.type === 'personal_choice') {
      if (answer !== 'A' && answer !== 'B') {
        throw new BadRequestException('Answer must be A or B');
      }

      return answer;
    }

    if (round.type === 'social_voting') {
      const targetPlayerId = typeof answer === 'string' ? Number(answer) : answer;
      if (!Number.isInteger(targetPlayerId) || !playerIds.includes(targetPlayerId)) {
        throw new BadRequestException('Vote target must be one of match players');
      }

      if (targetPlayerId === playerId) {
        throw new BadRequestException('You cannot vote for yourself in social voting round');
      }

      return targetPlayerId;
    }

    throw new BadRequestException('Unsupported round type');
  }

  async createMatch(playerIds: number[], durationMinutes = 10) {
    this.ensurePlayers(playerIds);

    if (!Number.isInteger(durationMinutes) || durationMinutes < 10 || durationMinutes > 20) {
      throw new BadRequestException('durationMinutes must be an integer in range 10..20');
    }

    const now = new Date().toISOString();
    const matchId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

    const match: SocialTournamentMatch = {
      id: matchId,
      playerIds,
      durationMinutes,
      createdAt: now,
      updatedAt: now,
      completed: false,
      currentRoundIndex: 0,
      scores: Object.fromEntries(playerIds.map((id) => [id.toString(), 0])),
      rounds: this.buildRounds(),
    };

    await this.persistMatch(match);

    return match;
  }

  async getMatch(matchId: string) {
    return this.loadMatch(matchId);
  }

  async submitRoundAnswer(matchId: string, playerId: number, answer: string | number) {
    const match = await this.loadMatch(matchId);

    if (match.completed) {
      throw new BadRequestException('Match is already completed');
    }

    if (!match.playerIds.includes(playerId)) {
      throw new BadRequestException('Player is not part of this match');
    }

    const currentRound = match.rounds[match.currentRoundIndex];

    if (!currentRound) {
      throw new InternalServerErrorException('Current round is not available');
    }

    const playerKey = playerId.toString();

    if (currentRound.answers[playerKey] !== undefined) {
      throw new BadRequestException('Answer for current round is already submitted');
    }

    const normalized = this.validateAndNormalizeRoundAnswer(
      currentRound,
      playerId,
      answer,
      match.playerIds,
    );

    currentRound.answers[playerKey] = normalized;

    if (Object.keys(currentRound.answers).length === PLAYERS_PER_MATCH) {
      this.resolveRound(match, currentRound);
    }

    match.updatedAt = new Date().toISOString();
    await this.persistMatch(match);

    return match;
  }
}
