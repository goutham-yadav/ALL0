import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { QueryProvider } from "@/components/query-provider";
import { Toaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Allo Inventory",
  description: "Race-condition safe inventory reservation with Redis + Prisma",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <QueryProvider>
          <header className="sticky top-0 z-50 w-full border-b border-zinc-200/80 bg-background/80 backdrop-blur-md dark:border-zinc-800/80">
            <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
              <div className="flex items-center gap-2">
                <div className="h-2.5 w-2.5 rounded-full bg-amber-500 animate-pulse" />
                <span className="text-sm font-bold tracking-tight text-foreground">
                  Allo Inventory
                </span>
              </div>
            </div>
          </header>
          
          <div className="flex-1">
            {children}
          </div>
        </QueryProvider>
        
        <Toaster richColors closeButton />
      </body>
    </html>
  );
}
