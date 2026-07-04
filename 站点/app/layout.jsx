import "./globals.css";

export const metadata = {
  title: "举报处理中心",
  description: "MC 服务器举报处理后台"
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
