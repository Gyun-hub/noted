import type { Metadata } from "next";
import { DevServiceWorkerCleanup } from "@/components/dev-sw-cleanup";
import "./globals.css";

// Pretendard: dynamic subset CSS라 화면에 쓰인 글자 조각만 내려받음
const PRETENDARD_CSS =
  "https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css";

export const metadata: Metadata = {
  title: "noted",
  description: "매일 할 일 체크리스트",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "noted",
  },
};

export const viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f3f6f9" },
    { media: "(prefers-color-scheme: dark)", color: "#0f1424" },
  ],
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="h-full antialiased">
      <head>
        <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="anonymous" />
        <link rel="stylesheet" href={PRETENDARD_CSS} crossOrigin="anonymous" />
      </head>
      <body className="min-h-full">
        {children}
        <DevServiceWorkerCleanup />
      </body>
    </html>
  );
}
