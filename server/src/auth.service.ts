import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { randomBytes, createHmac, pbkdf2Sync, timingSafeEqual } from 'node:crypto';
import { PrismaService } from './prisma.service';

type JwtPayload = {
  sub: number;
  nickname: string;
  iat: number;
  exp: number;
};

@Injectable()
export class AuthService {
  private readonly jwtSecret = process.env.JWT_SECRET ?? 'dev-secret-change-me';

  constructor(private readonly prisma: PrismaService) {}

  private base64Url(input: Buffer | string) {
    return Buffer.from(input)
      .toString('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
  }

  private signJwt(payload: Omit<JwtPayload, 'iat' | 'exp'>, expiresInSeconds = 60 * 60 * 24) {
    const now = Math.floor(Date.now() / 1000);
    const fullPayload: JwtPayload = {
      ...payload,
      iat: now,
      exp: now + expiresInSeconds,
    };

    const headerEncoded = this.base64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const payloadEncoded = this.base64Url(JSON.stringify(fullPayload));
    const content = `${headerEncoded}.${payloadEncoded}`;
    const signature = createHmac('sha256', this.jwtSecret).update(content).digest();
    return `${content}.${this.base64Url(signature)}`;
  }

  private verifyJwt(token: string): JwtPayload {
    const [header, payload, signature] = token.split('.');

    if (!header || !payload || !signature) {
      throw new UnauthorizedException('Invalid token format');
    }

    const content = `${header}.${payload}`;
    const expectedSignature = this.base64Url(createHmac('sha256', this.jwtSecret).update(content).digest());

    if (expectedSignature !== signature) {
      throw new UnauthorizedException('Invalid token signature');
    }

    const parsedPayload = JSON.parse(Buffer.from(payload, 'base64url').toString()) as JwtPayload;

    if (parsedPayload.exp <= Math.floor(Date.now() / 1000)) {
      throw new UnauthorizedException('Token expired');
    }

    return parsedPayload;
  }

  private hashPassword(password: string) {
    const salt = randomBytes(16).toString('hex');
    const hash = pbkdf2Sync(password, salt, 120000, 64, 'sha512').toString('hex');
    return `${salt}:${hash}`;
  }

  private verifyPassword(password: string, storedHash: string) {
    const [salt, originalHash] = storedHash.split(':');

    if (!salt || !originalHash) {
      return false;
    }

    const candidateHash = pbkdf2Sync(password, salt, 120000, 64, 'sha512').toString('hex');
    return timingSafeEqual(Buffer.from(candidateHash), Buffer.from(originalHash));
  }

  private async generateUniqueRefCode() {
    for (let i = 0; i < 10; i += 1) {
      const code = randomBytes(5).toString('hex').toUpperCase();
      const existing = await this.prisma.user.findUnique({ where: { refCode: code } });
      if (!existing) {
        return code;
      }
    }

    throw new BadRequestException('Failed to generate unique referral code');
  }

  async register(nickname: string, password: string, refCodeOptional?: string) {
    const normalizedNickname = nickname?.trim();

    if (!normalizedNickname || !password) {
      throw new BadRequestException('nickname and password are required');
    }

    const existing = await this.prisma.user.findUnique({ where: { nickname: normalizedNickname } });

    if (existing) {
      throw new BadRequestException('nickname already exists');
    }

    const passwordHash = this.hashPassword(password);
    const refCode = await this.generateUniqueRefCode();

    const createdUser = await this.prisma.$transaction(async (tx: any) => {
      const user = await tx.user.create({
        data: {
          nickname: normalizedNickname,
          passwordHash,
          refCode,
          wallet: {
            create: {
              balanceToken: 0,
              lockedToken: 0,
              stakedToken: 0,
            },
          },
        },
      });

      if (refCodeOptional) {
        const inviter = await tx.user.findUnique({ where: { refCode: refCodeOptional } });
        if (inviter && inviter.id !== user.id) {
          await tx.referral.create({
            data: {
              userId: user.id,
              inviterId: inviter.id,
              level: 1,
            },
          });
        }
      }

      return user;
    });

    return {
      id: createdUser.id,
      nickname: createdUser.nickname,
      refCode: createdUser.refCode,
    };
  }

  async login(nickname: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { nickname } });

    if (!user || !this.verifyPassword(password, user.passwordHash)) {
      throw new UnauthorizedException('Invalid nickname or password');
    }

    return {
      accessToken: this.signJwt({ sub: user.id, nickname: user.nickname }),
    };
  }

  parseToken(token: string) {
    return this.verifyJwt(token);
  }

  async me(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        nickname: true,
        gameRating: true,
        mlmRating: true,
        subscriptions: {
          orderBy: { endAt: 'desc' },
          take: 1,
          select: {
            tier: true,
            status: true,
            startAt: true,
            endAt: true,
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return {
      nickname: user.nickname,
      gameRating: user.gameRating,
      mlmRating: user.mlmRating,
      subscription: user.subscriptions[0] ?? null,
    };
  }
}
