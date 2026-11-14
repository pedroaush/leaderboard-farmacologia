import { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  Menu, X, LogOut, Home
} from "lucide-react";
import { NotificationBell } from "./StudentNotificationBanner";

const DARK_BG = "#0A1628";

interface StudentNavBarProps {
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  selectedClassId?: number;
  onClassChange?: (classId: number) => void;
  showClassSelector?: boolean;
  memberId?: number | null;
}

export default function StudentNavBar({
  memberId,
}: StudentNavBarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [, setLocation] = useLocation();

  return (
    <>
      <nav
        className="sticky top-0 z-40 border-b"
        style={{
          backgroundColor: DARK_BG,
          borderColor: "rgba(255,255,255,0.1)",
        }}
      >
        <div className="container mx-auto px-3 sm:px-4 2xl:px-8 py-2.5 sm:py-3 2xl:py-4">
          <div className="flex items-center justify-between gap-4">
            {/* Logo + Home */}
            <Link href="/" className="flex items-center gap-2 flex-shrink-0">
              <img
                src="/logos/TYglakFwBNwpBXzT.png"
                alt="Logo"
                className="h-8 w-auto"
              />
              <span className="font-bold text-white text-sm" style={{ fontFamily: "'Outfit', sans-serif" }}>
                Farmacologia
              </span>
            </Link>

            {/* Right Actions */}
            <div className="flex items-center gap-2 ml-auto">
              {/* Notification Bell */}
              {memberId && (
                <div
                  className="p-1.5 rounded-lg"
                  style={{
                    backgroundColor: "rgba(255,255,255,0.05)",
                  }}
                  title="Notificações"
                >
                  <NotificationBell memberId={memberId} />
                </div>
              )}

              {/* Leaderboard link */}
              <Link
                href="/leaderboard"
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={{
                  backgroundColor: "rgba(255,255,255,0.05)",
                  color: "rgba(255,255,255,0.6)",
                }}
              >
                <Home size={14} />
                <span>Leaderboard</span>
              </Link>

              {/* Logout */}
              <button
                onClick={() => {
                  sessionStorage.clear();
                  setLocation("/");
                }}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={{
                  backgroundColor: "rgba(255,255,255,0.05)",
                  color: "rgba(255,255,255,0.6)",
                }}
                title="Sair"
              >
                <LogOut size={14} />
                <span>Sair</span>
              </button>

              {/* Mobile Menu Toggle */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="sm:hidden p-1.5 rounded-lg"
                style={{
                  backgroundColor: "rgba(255,255,255,0.05)",
                  color: "rgba(255,255,255,0.6)",
                }}
              >
                {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
            </div>
          </div>

          {/* Mobile Menu */}
          {mobileMenuOpen && (
            <div className="sm:hidden mt-3 pt-3 border-t" style={{ borderColor: "rgba(255,255,255,0.1)" }}>
              <div className="flex gap-2">
                <Link
                  href="/leaderboard"
                  className="flex-1 flex items-center justify-center gap-1.5 px-2.5 py-2.5 rounded-lg text-xs font-medium min-h-[44px]"
                  style={{
                    backgroundColor: "rgba(255,255,255,0.05)",
                    color: "rgba(255,255,255,0.6)",
                  }}
                >
                  <Home size={14} />
                  <span>Leaderboard</span>
                </Link>

                <button
                  onClick={() => {
                    sessionStorage.clear();
                    setLocation("/");
                  }}
                  className="flex-1 flex items-center justify-center gap-1.5 px-2.5 py-2.5 rounded-lg text-xs font-medium min-h-[44px]"
                  style={{
                    backgroundColor: "rgba(255,255,255,0.05)",
                    color: "rgba(255,255,255,0.6)",
                  }}
                >
                  <LogOut size={14} />
                  <span>Sair</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </nav>
    </>
  );
}
