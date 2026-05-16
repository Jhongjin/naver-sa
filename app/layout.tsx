import type { Metadata } from "next";
import { AuthProvider } from "@/app/components/auth/AuthProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Naver SA Autopilot",
  description: "네이버 SA 세팅부터 운영까지 이어지는 자동화 플랫폼",
  applicationName: "Naver SA Autopilot",
  icons: {
    icon: "/icon.svg"
  },
  robots: {
    index: false,
    follow: false
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
