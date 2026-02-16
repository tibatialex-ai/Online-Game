import Link from "next/link";

const links = [
  { href: "/register", label: "Register" },
  { href: "/login", label: "Login" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/referrals", label: "Referrals" },
  { href: "/wallet", label: "Wallet" },
  { href: "/subscription", label: "Subscription" },
  { href: "/staking", label: "Staking" },
  { href: "/social-game", label: "Social Game" },
];

export function Nav() {
  return (
    <nav className="nav">
      {links.map((link) => (
        <Link key={link.href} href={link.href}>
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
