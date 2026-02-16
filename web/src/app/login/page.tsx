"use client";

import { FormEvent, useState } from "react";
import { PageShell } from "@/components/PageShell";
import { apiFetch, setJwt } from "@/lib/api";

export default function LoginPage() {
  const [nickname, setNickname] = useState("");
  const [password, setPassword] = useState("");
  const [state, setState] = useState("");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setState("");
    try {
      const data = await apiFetch<{ token: string }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ nickname, password }),
      });
      setJwt(data.token);
      setState("Logged in. JWT saved.");
    } catch (error) {
      setState(error instanceof Error ? error.message : "Login failed");
    }
  }

  return (
    <PageShell title="Login">
      <form onSubmit={onSubmit}>
        <label>
          Nickname
          <input value={nickname} onChange={(e) => setNickname(e.target.value)} required />
        </label>
        <label>
          Password
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        <button>Login</button>
      </form>
      {state && <p>{state}</p>}
    </PageShell>
  );
}
