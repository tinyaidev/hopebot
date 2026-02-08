"use client";

import Link from "next/link";
import { useState } from "react";

export default function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <nav className="bg-white/80 backdrop-blur-sm border-b border-[var(--color-gold-light)] sticky top-0 z-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link href="/" className="text-xl font-bold text-[var(--color-blue)]">
            Noahide Indiana
          </Link>

          {/* Desktop links */}
          <div className="hidden sm:flex gap-8">
            <Link
              href="/"
              className="text-[var(--color-text-muted)] hover:text-[var(--color-blue)] transition-colors"
            >
              Home
            </Link>
            <Link
              href="/events"
              className="text-[var(--color-text-muted)] hover:text-[var(--color-blue)] transition-colors"
            >
              Events
            </Link>
            <Link
              href="/resources"
              className="text-[var(--color-text-muted)] hover:text-[var(--color-blue)] transition-colors"
            >
              Resources
            </Link>
          </div>

          {/* Mobile menu button */}
          <button
            className="sm:hidden p-2 text-[var(--color-text-muted)]"
            onClick={() => setOpen(!open)}
            aria-label="Toggle menu"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              {open ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile menu */}
        {open && (
          <div className="sm:hidden pb-4 flex flex-col gap-2">
            <Link
              href="/"
              className="px-2 py-2 text-[var(--color-text-muted)] hover:text-[var(--color-blue)] transition-colors"
              onClick={() => setOpen(false)}
            >
              Home
            </Link>
            <Link
              href="/events"
              className="px-2 py-2 text-[var(--color-text-muted)] hover:text-[var(--color-blue)] transition-colors"
              onClick={() => setOpen(false)}
            >
              Events
            </Link>
            <Link
              href="/resources"
              className="px-2 py-2 text-[var(--color-text-muted)] hover:text-[var(--color-blue)] transition-colors"
              onClick={() => setOpen(false)}
            >
              Resources
            </Link>
          </div>
        )}
      </div>
    </nav>
  );
}
