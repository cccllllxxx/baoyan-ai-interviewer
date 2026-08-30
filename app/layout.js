import "./globals.css";

export const metadata = {
  title: "复试压力面 · AI 模拟面试官",
  description:
    "给保研学生的 AI 复试压力面试官：连续追问到你说不出来为止，结束后给出可执行的追问诊断报告。",
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
