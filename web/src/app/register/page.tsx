"use client";

import { FormEvent, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PageShell } from "@/components/PageShell";
import { apiFetch, setJwt } from "@/lib/api";

export default function RegisterPage() {
  const params = useSearchParams();
  const refFromUrl = useMemo(() => params.get("ref") ?? "", [params]);
  const [nickname, setNickname] = useState("");
  const [password, setPassword] = useState("");
  const [ref, setRef] = useState(refFromUrl);
  const [state, setState] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setState("");

    try {
      const data = await apiFetch<{ token?: string; message?: string }>("/auth/register", {
        method: "POST",
        body: JSON.stringify({ nickname, password, ref }),
      });
      if (data.token) setJwt(data.token);
      setState(data.message ?? "Registration successful");
    } catch (error) {
      setState(error instanceof Error ? error.message : "Registration failed");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <PageShell title="Register">
      <form onSubmit={onSubmit}>
        <label>
          Nickname
          <input value={nickname} onChange={(e) => setNickname(e.target.value)} required />
        </label>
        <label>
          Password
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        <label>
          Referrer
          <input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="from ?ref=" />
        </label>
        <button disabled={isLoading}>{isLoading ? "Creating..." : "Create account"}</button>
      </form>
      <p className="muted">JWT is stored in localStorage after successful registration/login.</p>
      {state && <p>{state}</p>}
    </PageShell>
  );
}
