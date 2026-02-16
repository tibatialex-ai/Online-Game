"use client";

import { useEffect, useState } from "react";
import { PageShell } from "@/components/PageShell";
import { apiFetch } from "@/lib/api";

type ReferralsData = {
  referralLink: string;
  upline: string | null;
  downline: string[];
};

export default function ReferralsPage() {
  const [data, setData] = useState<ReferralsData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch<ReferralsData>("/referrals", { withAuth: true })
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);

  return (
    <PageShell title="Referrals">
      {error && <p className="error">{error}</p>}
      {data && (
        <>
          <p>Referral link: {data.referralLink}</p>
          <p>Upline: {data.upline ?? "None"}</p>
          <h3>Downline</h3>
          {data.downline.length === 0 ? (
            <p className="muted">No referrals yet.</p>
          ) : (
            <ul>
              {data.downline.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}
        </>
      )}
      {!data && !error && <p className="muted">Loading...</p>}
    </PageShell>
  );
}
