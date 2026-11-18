"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CalendarDays,
  History,
  Users,
  Trophy,
  Settings,
  ArrowUpRight,
  Shield,
  X,
} from "lucide-react";
import { useClub } from "./provider";
const links = [
  ["/", "Dashboard", LayoutDashboard],
  ["/upcoming", "Upcoming match", CalendarDays],
  ["/club/draft-demo", "Try the live draft", Users],
  ["/matches", "Match history", History],
  ["/players", "Players", Users],
  ["/leaderboards", "Leaderboards", Trophy],
  ["/settings", "Club settings", Settings],
] as const;
export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const { s, update, notice, notify } = useClub();
  if (path.startsWith("/club")) return <>{children}</>;
  return (
    <div className="app">
      <aside className="sidebar">
        <Link href="/" className="brand">
          <span className="crest">
            TT<span>★</span>
          </span>
          <span>
            TEAM TONG<small>FOOTBALL CLUB</small>
          </span>
        </Link>
        <p className="nav-label">THE CLUBHOUSE</p>
        <nav>
          {links.map(([href, label, Icon]) => (
            <Link
              key={href}
              href={href}
              aria-label={label}
              aria-current={
                (href === "/" ? path === "/" : path.startsWith(href))
                  ? "page"
                  : undefined
              }
              className={
                (href === "/" ? path === "/" : path.startsWith(href))
                  ? "selected"
                  : ""
              }
            >
              <Icon size={19} />
              <span>{label}</span>
            </Link>
          ))}
        </nav>
        <div className="side-bottom">
          <Shield size={22} />
          <h4>One club. Our people.</h4>
          <p>
            Good football.
            <br />
            Even better company.
          </p>
          <span className="tiny">EST. 2026 • DHAKA</span>
        </div>
      </aside>
      <div className="workspace">
        <header>
          <span className="header-label">
            PRIVATE CLUB <span className="dot" /> SEASON 2026
          </span>
          <label className="viewer">
            Demo viewing as
            <select
              aria-label="Demo viewing as"
              value={s.viewer}
              onChange={(e) =>
                update((s) => {
                  s.viewer = e.target.value;
                })
              }
            >
              {s.players.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        </header>
        <div className="demo-banner">
          <span>
            <b>DEMO MODE</b> Fictional sample data · saved in this browser only
            · no sign-in or shared sync
          </span>
          <Link href="/club">
            Sign in to the real club <ArrowUpRight size={14} />
          </Link>
        </div>
        <main>{children}</main>
        <footer>
          TEAM TONG <span>Our football. Our stories.</span>
          <span>Phase 01 / Local demo</span>
        </footer>
      </div>
      {notice && (
        <div className="toast" role="status">
          {notice}
          <button aria-label="Dismiss notification" onClick={() => notify("")}>
            <X size={18} />
          </button>
        </div>
      )}
    </div>
  );
}
