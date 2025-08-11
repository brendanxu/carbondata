import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Header from "@/components/layout/Header";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "碳资产交易数据平台",
  description: "全球碳市场每日价格数据展示与分析平台，涵盖EU ETS、UK ETS、California、中国碳市场、CCER、CDR等主要市场",
  keywords: "碳交易,碳市场,EU ETS,UK ETS,California,CEA,CCER,CDR,碳价格,碳配额",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className={`${inter.className} antialiased bg-gray-50`}>
        <Header />
        <main className="min-h-screen">
          {children}
        </main>
        <footer className="bg-white border-t mt-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <p className="text-center text-sm text-gray-500">
              © 2024 碳资产交易数据平台. 数据仅供参考，不构成投资建议。
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
