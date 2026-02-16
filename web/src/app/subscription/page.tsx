"use client";

import { useState } from "react";
import { PageShell } from "@/components/PageShell";
import { apiFetch } from "@/lib/api";

const plans = [30, 60, 100];

export default function SubscriptionPage() {
  const [state, setState] = useState("");

  async function buy(days: number) {
    try {
      await apiFetch("/subscription/buy", {
        method: "POST",
        withAuth: true,
        body: JSON.stringify({ days }),
      });
      setState(`Subscription for ${days} days purchased`);
    } catch (error) {
      setState(error instanceof Error ? error.message : "Purchase failed");
    }
  }

  return (
    <PageShell title="Subscription">
      <p>Buy one of the plans:</p>
      <div className="nav">
        {plans.map((plan) => (
          <button key={plan} onClick={() => buy(plan)}>
            {plan} days
          </button>
        ))}
      </div>
      {state && <p>{state}</p>}
    </PageShell>
  );
}
