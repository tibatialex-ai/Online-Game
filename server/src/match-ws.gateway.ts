import {
  BadRequestException,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { createHash } from 'node:crypto';
import { IncomingMessage } from 'node:http';
import { Socket } from 'node:net';
import { AuthService } from './auth.service';
import {
  SocialTournamentMatch,
  SocialTournamentService,
} from './social-tournament.service';

type WsEvent =
  | 'joinQueue'
  | 'matchFound'
  | 'roundState'
  | 'submitAnswer'
  | 'roundResult'
  | 'matchResult'
  | 'chatMessage'
  | 'error';

interface SocketContext {
  socket: Socket;
  userId: number;
  buffer: Buffer;
}

@Injectable()
export class MatchWsGateway implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MatchWsGateway.name);
  private readonly clientContexts = new Map<Socket, SocketContext>();
  private readonly userSockets = new Map<number, Set<Socket>>();
  private readonly matchSockets = new Map<string, Set<Socket>>();

  constructor(
    private readonly httpAdapterHost: HttpAdapterHost,
    private readonly authService: AuthService,
    private readonly socialTournamentService: SocialTournamentService,
  ) {}

  onModuleInit() {
    const server = this.httpAdapterHost.httpAdapter.getHttpServer();
    server.on('upgrade', (req: IncomingMessage, socket: Socket) => {
      this.handleUpgrade(req, socket);
    });
  }

  onModuleDestroy() {
    for (const context of this.clientContexts.values()) {
      context.socket.destroy();
    }
  }

  private handleUpgrade(req: IncomingMessage, socket: Socket) {
    if (!(req.url ?? '').startsWith('/ws/match')) {
      socket.destroy();
      return;
    }

    try {
      const token = this.extractToken(req);
      const payload = this.authService.parseToken(token);
      this.acceptConnection(req, socket, payload.sub);
    } catch (error) {
      this.sendHttpErrorAndClose(socket, 401, 'Unauthorized');
    }
  }

  private extractToken(req: IncomingMessage) {
    const reqUrl = new URL(req.url ?? '', 'http://localhost');
    const queryToken = reqUrl.searchParams.get('token');
    if (queryToken) {
      return queryToken;
    }

    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      return authHeader.slice('Bearer '.length);
    }

    throw new UnauthorizedException('JWT token is required');
  }

  private acceptConnection(req: IncomingMessage, socket: Socket, userId: number) {
    const wsKey = req.headers['sec-websocket-key'];

    if (!wsKey || typeof wsKey !== 'string') {
      this.sendHttpErrorAndClose(socket, 400, 'Bad Request');
      return;
    }

    const acceptValue = createHash('sha1')
      .update(`${wsKey}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
      .digest('base64');

    const headers = [
      'HTTP/1.1 101 Switching Protocols',
      'Upgrade: websocket',
      'Connection: Upgrade',
      `Sec-WebSocket-Accept: ${acceptValue}`,
      '',
      '',
    ];

    socket.write(headers.join('\r\n'));

    const context: SocketContext = {
      socket,
      userId,
      buffer: Buffer.alloc(0),
    };

    this.clientContexts.set(socket, context);
    const sockets = this.userSockets.get(userId) ?? new Set<Socket>();
    sockets.add(socket);
    this.userSockets.set(userId, sockets);

    socket.on('data', (chunk) => this.onSocketData(socket, chunk));
    socket.on('close', () => this.cleanupSocket(socket));
    socket.on('end', () => this.cleanupSocket(socket));
    socket.on('error', () => this.cleanupSocket(socket));
  }

  private cleanupSocket(socket: Socket) {
    const context = this.clientContexts.get(socket);
    if (!context) {
      return;
    }

    this.clientContexts.delete(socket);

    const userSet = this.userSockets.get(context.userId);
    userSet?.delete(socket);
    if (userSet && userSet.size === 0) {
      this.userSockets.delete(context.userId);
    }

    for (const [matchId, sockets] of this.matchSockets.entries()) {
      sockets.delete(socket);
      if (sockets.size === 0) {
        this.matchSockets.delete(matchId);
      }
    }
  }

  private onSocketData(socket: Socket, chunk: Buffer) {
    const context = this.clientContexts.get(socket);
    if (!context) {
      return;
    }

    context.buffer = Buffer.concat([context.buffer, chunk]);

    while (true) {
      const frame = this.tryReadTextFrame(context.buffer);
      if (!frame) {
        break;
      }

      context.buffer = frame.rest;
      this.onMessage(context, frame.text);
    }
  }

  private tryReadTextFrame(buffer: Buffer): { text: string; rest: Buffer } | null {
    if (buffer.length < 2) {
      return null;
    }

    const first = buffer[0];
    const opcode = first & 0x0f;
    if (opcode === 0x8) {
      return null;
    }

    if (opcode !== 0x1) {
      throw new BadRequestException('Only text WebSocket frames are supported');
    }

    const second = buffer[1];
    const masked = (second & 0x80) !== 0;
    let length = second & 0x7f;
    let offset = 2;

    if (length === 126) {
      if (buffer.length < offset + 2) {
        return null;
      }
      length = buffer.readUInt16BE(offset);
      offset += 2;
    } else if (length === 127) {
      throw new BadRequestException('Payload too large');
    }

    if (!masked) {
      throw new BadRequestException('Client frames must be masked');
    }

    if (buffer.length < offset + 4 + length) {
      return null;
    }

    const mask = buffer.subarray(offset, offset + 4);
    offset += 4;
    const payload = buffer.subarray(offset, offset + length);
    const decoded = Buffer.alloc(length);

    for (let i = 0; i < payload.length; i += 1) {
      decoded[i] = payload[i] ^ mask[i % 4];
    }

    return {
      text: decoded.toString('utf8'),
      rest: buffer.subarray(offset + length),
    };
  }

  private onMessage(context: SocketContext, raw: string) {
    try {
      const parsed = JSON.parse(raw) as { event?: WsEvent; payload?: any };
      if (!parsed.event) {
        throw new BadRequestException('event is required');
      }

      if (parsed.event === 'joinQueue') {
        void this.handleJoinQueue(context, parsed.payload);
        return;
      }

      if (parsed.event === 'submitAnswer') {
        void this.handleSubmitAnswer(context, parsed.payload);
        return;
      }

      if (parsed.event === 'chatMessage') {
        void this.handleChatMessage(context, parsed.payload);
        return;
      }

      this.sendEvent(context.socket, 'error', {
        message: `Unsupported event: ${parsed.event}`,
      });
    } catch (error) {
      this.sendEvent(context.socket, 'error', {
        message: error instanceof Error ? error.message : 'Invalid message',
      });
    }
  }

  private async handleJoinQueue(context: SocketContext, payload: { mode?: 'free' | 'paid'; stakeAmount?: number | string }) {
    try {
      const result = await this.socialTournamentService.joinMatchmaking(
        context.userId,
        payload?.mode ?? 'free',
        payload?.stakeAmount,
      );

      if (result.status !== 'matched' || !result.match) {
        this.sendEvent(context.socket, 'joinQueue', result);
        return;
      }

      const { match } = result;
      for (const playerId of match.playerIds) {
        this.addUserToMatchRoom(playerId, match.id);
      }

      this.broadcastToMatch(match.id, 'matchFound', { match });
      const state = this.socialTournamentService.buildRoundState(match);
      if (state) {
        this.broadcastToMatch(match.id, 'roundState', state);
      }
    } catch (error) {
      this.sendEvent(context.socket, 'error', {
        message: error instanceof Error ? error.message : 'Failed to join queue',
      });
    }
  }

  private async handleSubmitAnswer(
    context: SocketContext,
    payload: { matchId?: string; answer?: string | number },
  ) {
    try {
      if (!payload?.matchId) {
        throw new BadRequestException('matchId is required');
      }

      const result = await this.socialTournamentService.submitRoundAnswerDetailed(
        payload.matchId,
        context.userId,
        payload.answer as string | number,
      );

      this.addUserSocketToMatch(payload.matchId, context.socket);

      const state = this.socialTournamentService.buildRoundState(result.match);
      if (state) {
        this.broadcastToMatch(payload.matchId, 'roundState', state);
      }

      if (result.roundResult) {
        this.broadcastToMatch(payload.matchId, 'roundResult', result.roundResult);
      }

      if (result.matchResult) {
        this.broadcastToMatch(payload.matchId, 'matchResult', result.matchResult);
      }
    } catch (error) {
      this.sendEvent(context.socket, 'error', {
        message: error instanceof Error ? error.message : 'Failed to submit answer',
      });
    }
  }

  private async handleChatMessage(
    context: SocketContext,
    payload: { matchId?: string; message?: string },
  ) {
    try {
      const matchId = payload?.matchId;
      if (!matchId) {
        throw new BadRequestException('matchId is required');
      }

      const text = (payload.message ?? '').trim();
      if (!text) {
        throw new BadRequestException('message is required');
      }

      if (text.length > 500) {
        throw new BadRequestException('message is too long');
      }

      const match = await this.socialTournamentService.getMatch(matchId);
      this.ensureMatchParticipant(match, context.userId);

      this.addUserSocketToMatch(matchId, context.socket);
      this.broadcastToMatch(matchId, 'chatMessage', {
        matchId,
        fromUserId: context.userId,
        message: text,
        createdAt: new Date().toISOString(),
      });
    } catch (error) {
      this.sendEvent(context.socket, 'error', {
        message: error instanceof Error ? error.message : 'Failed to send chat message',
      });
    }
  }

  private ensureMatchParticipant(match: SocialTournamentMatch, userId: number) {
    if (!match.playerIds.includes(userId)) {
      throw new UnauthorizedException('Chat is allowed only for match participants');
    }
  }

  private addUserToMatchRoom(userId: number, matchId: string) {
    const sockets = this.userSockets.get(userId);
    if (!sockets) {
      return;
    }

    for (const socket of sockets) {
      this.addUserSocketToMatch(matchId, socket);
    }
  }

  private addUserSocketToMatch(matchId: string, socket: Socket) {
    const sockets = this.matchSockets.get(matchId) ?? new Set<Socket>();
    sockets.add(socket);
    this.matchSockets.set(matchId, sockets);
  }

  private broadcastToMatch(matchId: string, event: WsEvent, payload: unknown) {
    const sockets = this.matchSockets.get(matchId);
    if (!sockets) {
      return;
    }

    for (const socket of sockets) {
      this.sendEvent(socket, event, payload);
    }
  }

  private sendEvent(socket: Socket, event: WsEvent, payload: unknown) {
    const message = JSON.stringify({ event, payload });
    const frame = this.createTextFrame(message);

    if (socket.destroyed) {
      return;
    }

    socket.write(frame);
  }

  private createTextFrame(text: string) {
    const payload = Buffer.from(text, 'utf8');

    if (payload.length >= 65536) {
      throw new BadRequestException('Payload too large');
    }

    if (payload.length < 126) {
      return Buffer.concat([Buffer.from([0x81, payload.length]), payload]);
    }

    const header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 126;
    header.writeUInt16BE(payload.length, 2);
    return Buffer.concat([header, payload]);
  }

  private sendHttpErrorAndClose(socket: Socket, status: number, message: string) {
    const body = `${message}\n`;
    const response = [
      `HTTP/1.1 ${status} ${message}`,
      'Connection: close',
      `Content-Length: ${Buffer.byteLength(body)}`,
      'Content-Type: text/plain; charset=utf-8',
      '',
      body,
    ].join('\r\n');

    socket.end(response);
    this.logger.warn(`WS upgrade rejected: ${status} ${message}`);
  }
}
