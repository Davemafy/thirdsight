import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MarketLab — ThirdSight Commerce Harness",
  description: "Synthetic commerce traffic for ThirdSight integration verification",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
