"use client";

import { FormEvent, useEffect, useState } from "react";
import { PageShell } from "@/components/PageShell";
import { apiFetch } from "@/lib/api";

type WalletData = {
  balance: number;
  ledger: Array<{ id: string; type: string; amount: number; createdAt: string }>;
};

export default function WalletPage() {
  const [data, setData] = useState<WalletData | null>(null);
  const [toUser, setToUser] = useState("");
  const [amount, setAmount] = useState("");
  const [state, setState] = useState("");
  const isDev = process.env.NODE_ENV === "development";

  async function refresh() {
    const wallet = await apiFetch<WalletData>("/wallet", { withAuth: true });
    setData(wallet);
  }

  useEffect(() => {
    refresh().catch((e) => setState(e.message));
  }, []);

  async function faucet() {
    try {
      await apiFetch("/wallet/faucet", { method: "POST", withAuth: true });
      await refresh();
      setState("Faucet success");
    } catch (e) {
      setState(e instanceof Error ? e.message : "Faucet failed");
    }
  }

  async function transfer(e: FormEvent) {
    e.preventDefault();
    try {
      await apiFetch("/wallet/transfer", {
        method: "POST",
        withAuth: true,
        body: JSON.stringify({ to: toUser, amount: Number(amount) }),
      });
      setToUser("");
      setAmount("");
      await refresh();
      setState("Transfer done");
    } catch (err) {
      setState(err instanceof Error ? err.message : "Transfer failed");
    }
  }

  return (
    <PageShell title="Wallet">
      <p>Balance: {data?.balance ?? "..."}</p>
      {isDev && <button onClick={faucet}>Faucet (dev only)</button>}
      <h3>Transfer</h3>
      <form onSubmit={transfer}>
        <label>
          To nickname
          <input value={toUser} onChange={(e) => setToUser(e.target.value)} required />
        </label>
        <label>
          Amount
          <input value={amount} onChange={(e) => setAmount(e.target.value)} required />
        </label>
        <button>Send</button>
      </form>
      <h3>Ledger</h3>
      <ul>
        {(data?.ledger ?? []).map((item) => (
          <li key={item.id}>
            {item.createdAt}: {item.type} {item.amount}
          </li>
        ))}
      </ul>
      {state && <p>{state}</p>}
    </PageShell>
  );
}
