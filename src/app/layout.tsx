import type { Metadata } from "next";
import "./globals.css";
import { Provider } from "@/components/provider";
import { Shell } from "@/components/shell";
export const metadata: Metadata = {
  title: "Team Tong · The clubhouse",
  description: "Your football. Your people. Team Tong demo clubhouse.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Provider>
          <Shell>{children}</Shell>
        </Provider>
      </body>
    </html>
  );
}
