import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GroundTruth",
  description: "Civic infrastructure and environmental intelligence",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased bg-slate-950 text-slate-100">
        {children}
      </body>
    </html>
  );
}