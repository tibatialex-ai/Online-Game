import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Online Game Cabinet",
  description: "Simple frontend for auth, wallet, subscription and staking",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
