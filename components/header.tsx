"use client";

import { useState, useEffect } from "react";
import { BookOpen, Keyboard, Moon, Sun } from "lucide-react";

export function Header() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggleTheme() {
    const next = !isDark;
    document.documentElement.classList.toggle("dark", next);
    document.documentElement.classList.toggle("light", !next);
    localStorage.setItem("theme", next ? "dark" : "light");
    setIsDark(next);
  }

  return (
    <header className="h-14 border-b flex items-center px-5 shrink-0 bg-card">
      <div className="flex items-center gap-2.5">
        <div className="flex items-center justify-center w-7 h-7 rounded-md bg-accent text-white">
          <BookOpen className="w-4 h-4" />
        </div>
        <span className="text-[15px] font-semibold tracking-tight text-foreground">
          Debate Search
        </span>
      </div>

      <div className="flex-1" />

      <nav className="flex items-center gap-1">
        <NavItem label="Search" active />
        <NavItem label="Collections" />
        <NavItem label="History" />
        <div className="ml-3 flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] text-muted-foreground">
          <Keyboard className="w-3 h-3" />
          <span className="font-mono">/</span>
        </div>
        <button
          onClick={toggleTheme}
          aria-label="Toggle theme"
          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-surface transition-colors"
        >
          {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
      </nav>
    </header>
  );
}

function NavItem({ label, active }: { label: string; active?: boolean }) {
  return (
    <button
      className={`px-3 py-1.5 rounded-md text-[13px] font-medium transition-colors ${
        active
          ? "bg-surface text-foreground"
          : "text-muted-foreground hover:text-foreground hover:bg-surface"
      }`}
    >
      {label}
    </button>
  );
}
