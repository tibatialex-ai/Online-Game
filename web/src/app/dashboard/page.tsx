"use client";

import { useEffect, useState } from "react";
import { PageShell } from "@/components/PageShell";
import { apiFetch } from "@/lib/api";

type DashboardResponse = {
  profile: { nickname: string; id: string };
  balance: number;
  subscription: { plan: string; expiresAt: string | null };
};

export default function DashboardPage() {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch<DashboardResponse>("/dashboard", { withAuth: true })
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);

  return (
    <PageShell title="Dashboard">
      {error && <p className="error">{error}</p>}
      {!data && !error && <p className="muted">Loading...</p>}
      {data && (
        <div className="grid grid-2">
          <div className="card">
            <h3>Profile</h3>
            <p>Nickname: {data.profile.nickname}</p>
            <p>ID: {data.profile.id}</p>
          </div>
          <div className="card">
            <h3>Balance</h3>
            <p>{data.balance}</p>
          </div>
          <div className="card">
            <h3>Subscription</h3>
            <p>Plan: {data.subscription.plan || "none"}</p>
            <p>Expires: {data.subscription.expiresAt ?? "-"}</p>
          </div>
        </div>
      )}
    </PageShell>
  );
}
