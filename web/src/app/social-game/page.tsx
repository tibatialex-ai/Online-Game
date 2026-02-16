"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { PageShell } from "@/components/PageShell";
import { apiFetch, getJwt } from "@/lib/api";

type QueueMode = "free" | "paid";

type JoinQueuePayload = {
  status: "queued" | "matched";
  mode: QueueMode;
  stakeAmount?: string;
  queuedPlayers?: number;
  playersNeeded?: number;
  match?: {
    id: string;
    playerIds: number[];
    mode: QueueMode;
    stakeAmount: string | null;
  };
};

type RoundStatePayload = {
  matchId: string;
  roundNumber: number;
  type: "logic" | "group_voting" | "personal_choice" | "social_voting";
  playersAnswered: number;
  totalPlayers: number;
};

type RoundResultPayload = {
  matchId: string;
  roundNumber: number;
  type: string;
  details: Record<string, string | number>;
  scores: Record<string, number>;
};

type MatchResultPayload = {
  matchId: string;
  winners: number[];
  scores: Record<string, number>;
};

type WalletResponse = {
  balanceToken: string;
};

type WsIncoming = {
  event:
    | "joinQueue"
    | "matchFound"
    | "roundState"
    | "roundResult"
    | "matchResult"
    | "error";
  payload: unknown;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

function toWsUrl(token: string) {
  const base = new URL(API_URL);
  base.protocol = base.protocol === "https:" ? "wss:" : "ws:";
  base.pathname = "/ws/match";
  base.search = `token=${encodeURIComponent(token)}`;
  return base.toString();
}

function formatScores(scores: Record<string, number>) {
  return Object.entries(scores)
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([playerId, score]) => `#${playerId}: ${score}`)
    .join(" | ");
}

export default function SocialGamePage() {
  const wsRef = useRef<WebSocket | null>(null);
  const [mode, setMode] = useState<QueueMode>("free");
  const [stakeAmount, setStakeAmount] = useState("0.5");
  const [isQueueing, setIsQueueing] = useState(false);
  const [wsReady, setWsReady] = useState(false);
  const [error, setError] = useState("");
  const [queueStatus, setQueueStatus] = useState("");
  const [activeMatchId, setActiveMatchId] = useState("");
  const [roundState, setRoundState] = useState<RoundStatePayload | null>(null);
  const [roundResult, setRoundResult] = useState<RoundResultPayload | null>(null);
  const [matchResult, setMatchResult] = useState<MatchResultPayload | null>(null);
  const [answerValue, setAnswerValue] = useState("");
  const [balance, setBalance] = useState<string | null>(null);

  const canJoinQueue = useMemo(() => {
    if (!wsReady || isQueueing) return false;
    if (mode === "paid") {
      return Number(stakeAmount) > 0;
    }
    return true;
  }, [isQueueing, mode, stakeAmount, wsReady]);

  useEffect(() => {
    const token = getJwt();
    if (!token) {
      setError("Нужен логин: JWT отсутствует.");
      return;
    }

    const socket = new WebSocket(toWsUrl(token));
    wsRef.current = socket;

    socket.onopen = () => {
      setWsReady(true);
      setError("");
    };

    socket.onclose = () => {
      setWsReady(false);
    };

    socket.onerror = () => {
      setError("Ошибка WebSocket подключения.");
    };

    socket.onmessage = (message) => {
      try {
        const data = JSON.parse(message.data as string) as WsIncoming;

        if (data.event === "joinQueue") {
          const payload = data.payload as JoinQueuePayload;
          if (payload.status === "queued") {
            const stakeInfo = payload.mode === "paid" ? ` (stake ${payload.stakeAmount})` : "";
            setQueueStatus(`В очереди${stakeInfo}: ${payload.queuedPlayers ?? 0}/10. Осталось: ${payload.playersNeeded ?? 0}`);
          }
          setIsQueueing(false);
          return;
        }

        if (data.event === "matchFound") {
          const payload = data.payload as { match: { id: string; mode: QueueMode; stakeAmount: string | null } };
          setActiveMatchId(payload.match.id);
          setQueueStatus(
            payload.match.mode === "paid"
              ? `Матч найден: ${payload.match.id}, paid (stake ${payload.match.stakeAmount})`
              : `Матч найден: ${payload.match.id}, free`,
          );
          setMatchResult(null);
          return;
        }

        if (data.event === "roundState") {
          const payload = data.payload as RoundStatePayload;
          setRoundState(payload);
          return;
        }

        if (data.event === "roundResult") {
          setRoundResult(data.payload as RoundResultPayload);
          return;
        }

        if (data.event === "matchResult") {
          const payload = data.payload as MatchResultPayload;
          setMatchResult(payload);
          void apiFetch<WalletResponse>("/wallet", { withAuth: true })
            .then((wallet) => setBalance(wallet.balanceToken))
            .catch(() => setBalance(null));
          return;
        }

        if (data.event === "error") {
          const payload = data.payload as { message?: string };
          setError(payload.message ?? "Ошибка сокета");
          setIsQueueing(false);
        }
      } catch {
        setError("Невалидное сообщение от WebSocket.");
      }
    };

    return () => {
      socket.close();
      wsRef.current = null;
    };
  }, []);

  const submitJoinQueue = (event: FormEvent) => {
    event.preventDefault();
    setError("");

    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      setError("WebSocket не подключен.");
      return;
    }

    const payload: { mode: QueueMode; stakeAmount?: number } = {
      mode,
    };

    if (mode === "paid") {
      payload.stakeAmount = Number(stakeAmount);
    }

    wsRef.current.send(
      JSON.stringify({
        event: "joinQueue",
        payload,
      }),
    );

    setIsQueueing(true);
    setQueueStatus("Отправлен запрос на вход в очередь...");
  };

  const submitAnswer = (event: FormEvent) => {
    event.preventDefault();

    if (!activeMatchId) {
      setError("Матч не найден. Сначала войдите в очередь.");
      return;
    }

    if (!answerValue.trim()) {
      setError("Введите ответ.");
      return;
    }

    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      setError("WebSocket не подключен.");
      return;
    }

    const answer = Number.isNaN(Number(answerValue)) ? answerValue.trim() : Number(answerValue);

    wsRef.current.send(
      JSON.stringify({
        event: "submitAnswer",
        payload: {
          matchId: activeMatchId,
          answer,
        },
      }),
    );

    setError("");
  };

  return (
    <PageShell title="Social Game">
      <div className="card">
        <h3>Вход в здание Social Game</h3>
        <form onSubmit={submitJoinQueue}>
          <label>
            Режим
            <select value={mode} onChange={(e) => setMode(e.target.value as QueueMode)}>
              <option value="free">free</option>
              <option value="paid">paid</option>
            </select>
          </label>

          {mode === "paid" && (
            <label>
              Ставка
              <input
                type="number"
                min="0.5"
                step="0.1"
                value={stakeAmount}
                onChange={(e) => setStakeAmount(e.target.value)}
              />
            </label>
          )}

          <button type="submit" disabled={!canJoinQueue}>
            Встать в очередь
          </button>
        </form>
        <p className="muted">WebSocket: {wsReady ? "подключен" : "не подключен"}</p>
      </div>

      {queueStatus && (
        <div className="card">
          <h3>Очередь</h3>
          <p>{queueStatus}</p>
        </div>
      )}

      {roundState && (
        <div className="card">
          <h3>Round State</h3>
          <p>Match: {roundState.matchId}</p>
          <p>Round: {roundState.roundNumber}</p>
          <p>Type: {roundState.type}</p>
          <p>
            Answered: {roundState.playersAnswered}/{roundState.totalPlayers}
          </p>
        </div>
      )}

      {activeMatchId && (
        <div className="card">
          <h3>Submit Answer</h3>
          <form onSubmit={submitAnswer}>
            <label>
              Ответ
              <input
                value={answerValue}
                onChange={(e) => setAnswerValue(e.target.value)}
                placeholder="0..3 / A,B / playerId"
              />
            </label>
            <button type="submit">submitAnswer</button>
          </form>
        </div>
      )}

      {roundResult && (
        <div className="card">
          <h3>Результаты раунда</h3>
          <p>Round: {roundResult.roundNumber}</p>
          <p>Type: {roundResult.type}</p>
          <p>Details: {JSON.stringify(roundResult.details)}</p>
          <p>Scores: {formatScores(roundResult.scores)}</p>
        </div>
      )}

      {matchResult && (
        <div className="card">
          <h3>Match Result</h3>
          <p>Match: {matchResult.matchId}</p>
          <p>Winners: {matchResult.winners.join(", ")}</p>
          <p>Scores: {formatScores(matchResult.scores)}</p>
          <p>Актуальный баланс: {balance ?? "не удалось обновить"}</p>
        </div>
      )}

      {error && <p className="error">{error}</p>}
    </PageShell>
  );
}
