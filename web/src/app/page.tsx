import Link from "next/link";
import { PageShell } from "@/components/PageShell";

export default function Home() {
  return (
    <PageShell title="Online Game Web">
      <p className="muted">Choose a page from navigation or start with authentication.</p>
      <p>
        <Link href="/register">Go to register</Link>
      </p>
    </PageShell>
  );
}
