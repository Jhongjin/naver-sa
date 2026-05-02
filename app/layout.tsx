import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Naver SA Autopilot",
  description: "네이버 SA 세팅부터 운영까지 이어지는 자동화 플랫폼"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}

