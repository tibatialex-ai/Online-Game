import { Nav } from "@/components/Nav";
import { ReactNode } from "react";

export function PageShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="container">
      <Nav />
      <section className="card">
        <h1>{title}</h1>
        {children}
      </section>
    </main>
  );
}
