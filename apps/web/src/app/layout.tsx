import type { Metadata } from "next";
import { RealtimeToastBridge } from "../components/realtime/realtime-toast-bridge";
import { ProudFlowQueryProvider } from "../lib/query/provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Proud Flow",
  description: "Proud Flow requirements workspace",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>
        <ProudFlowQueryProvider>
          <RealtimeToastBridge />
          {children}
        </ProudFlowQueryProvider>
      </body>
    </html>
  );
}
