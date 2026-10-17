import type { Metadata } from "next";
import Link from "next/link";
import { IBM_Plex_Mono, Newsreader, Source_Sans_3 } from "next/font/google";
import "./globals.css";

const serif = Newsreader({ variable: "--font-newsreader", subsets: ["latin"], style: ["normal", "italic"] });
const sans = Source_Sans_3({ variable: "--font-source-sans", subsets: ["latin"] });
const mono = IBM_Plex_Mono({ variable: "--font-plex-mono", subsets: ["latin"], weight: ["400", "500"] });

export const metadata: Metadata = {
  title: { default: "On Record", template: "%s · On Record" },
  description: "A daily filing of what companies say, on the record, about how they use AI.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-GB">
      <body className={`${serif.variable} ${sans.variable} ${mono.variable} antialiased`}>
        <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-16">
          <header className="mb-10 border-b-2 border-foreground pb-4">
            <Link href="/" className="font-serif text-4xl font-bold tracking-tight sm:text-5xl">
              On Record
            </Link>
            <p className="mt-1 font-mono text-xs uppercase tracking-widest text-muted">
              Company AI announcements, filed daily
            </p>
          </header>
          <main>{children}</main>
          <footer className="mt-20 border-t border-rule pt-4 text-sm text-muted">
            Sources: SEC EDGAR and UK regulatory announcements. Every note quotes its source word for word.
          </footer>
        </div>
      </body>
    </html>
  );
}
