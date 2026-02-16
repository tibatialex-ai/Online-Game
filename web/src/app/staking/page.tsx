"use client";

import { FormEvent, useEffect, useState } from "react";
import { PageShell } from "@/components/PageShell";
import { apiFetch } from "@/lib/api";

type StakingData = {
  staked: number;
  reward: number;
  status: string;
};

export default function StakingPage() {
  const [amount, setAmount] = useState("");
  const [state, setState] = useState("");
  const [data, setData] = useState<StakingData | null>(null);

  async function refresh() {
    const status = await apiFetch<StakingData>("/staking/status", { withAuth: true });
    setData(status);
  }

  useEffect(() => {
    refresh().catch((e) => setState(e.message));
  }, []);

  async function stake(e: FormEvent) {
    e.preventDefault();
    try {
      await apiFetch("/staking/stake", {
        method: "POST",
        withAuth: true,
        body: JSON.stringify({ amount: Number(amount) }),
      });
      setAmount("");
      await refresh();
      setState("Stake successful");
    } catch (error) {
      setState(error instanceof Error ? error.message : "Stake failed");
    }
  }

  return (
    <PageShell title="Staking">
      <form onSubmit={stake}>
        <label>
          Amount to stake
          <input value={amount} onChange={(e) => setAmount(e.target.value)} required />
        </label>
        <button>Stake</button>
      </form>
      <h3>Status</h3>
      <p>Staked: {data?.staked ?? "..."}</p>
      <p>Reward: {data?.reward ?? "..."}</p>
      <p>Status: {data?.status ?? "..."}</p>
      {state && <p>{state}</p>}
    </PageShell>
  );
}
