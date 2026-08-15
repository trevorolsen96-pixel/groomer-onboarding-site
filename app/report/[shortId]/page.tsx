"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

type Tag = { id: string; label: string; emoji: string | null };

type ReportData = {
  pet_name: string;
  pet_breed: string | null;
  pet_image_url: string | null;
  business_name: string;
  business_logo_url: string | null;
  theme: string;
  headline: string | null;
  note: string | null;
  tags: Tag[];
  before_photo_url: string | null;
  after_photo_url: string | null;
  sent_at: string | null;
  expires_at: string | null;
};

type ThemeStyle = {
  background: string;
  cardBackground: string;
  accent: string;
  accentSoft: string;
  text: string;
  textSecondary: string;
  chipBackground: string;
  chipText: string;
  // Small decorative touch shown next to the business name.
  accentEmoji?: string;
  // 2-3 icons cycled through for the scattered background splash --
  // falls back to [accentEmoji] if not set.
  decorEmojis?: string[];
};

const THEMES: Record<string, ThemeStyle> = {
  wagzly_classic: {
    background: "linear-gradient(160deg, #f7e6ec 0%, #fbf7f8 55%, #fdf9f5 100%)",
    cardBackground: "#ffffff",
    accent: "#c58fa1",
    accentSoft: "#f2dee5",
    text: "#2e2430",
    textSecondary: "#7a6b74",
    chipBackground: "#f7e6ec",
    chipText: "#8a5a6c",
    accentEmoji: "🐾",
    decorEmojis: ["🐾", "✨"],
  },
  new_years: {
    background: "linear-gradient(160deg, #f5eeda 0%, #faf5e8 55%, #fffbf0 100%)",
    cardBackground: "#ffffff",
    accent: "#b8860b",
    accentSoft: "#ecd9a0",
    text: "#2b2410",
    textSecondary: "#7a6f4a",
    chipBackground: "#ecd9a0",
    chipText: "#8a6f10",
    accentEmoji: "🎉",
    decorEmojis: ["🎉", "✨", "🥂"],
  },
  st_patricks_day: {
    background: "linear-gradient(160deg, #dcf0d8 0%, #eef8ec 55%, #f8fdf6 100%)",
    cardBackground: "#ffffff",
    accent: "#2f8a3e",
    accentSoft: "#c8e8c0",
    text: "#1a2e1a",
    textSecondary: "#5c7a5c",
    chipBackground: "#c8e8c0",
    chipText: "#1f6b2a",
    accentEmoji: "☘️",
    decorEmojis: ["☘️", "🍀"],
  },
  memorial_day: {
    background: "linear-gradient(160deg, #e6e9f0 0%, #f0f2f7 55%, #f9fafc 100%)",
    cardBackground: "#ffffff",
    accent: "#5a6b8c",
    accentSoft: "#d3d8e6",
    text: "#242938",
    textSecondary: "#6b7488",
    chipBackground: "#d3d8e6",
    chipText: "#3f4a66",
    accentEmoji: "🎖️",
    decorEmojis: ["🎖️", "⭐"],
  },
  halloween: {
    background: "linear-gradient(160deg, #ffe0c2 0%, #fff0dc 55%, #fff8f0 100%)",
    cardBackground: "#ffffff",
    accent: "#c2510f",
    accentSoft: "#f7d3ad",
    text: "#2b1810",
    textSecondary: "#7a5c3e",
    chipBackground: "#f7d3ad",
    chipText: "#8a3d0f",
    accentEmoji: "🎃",
    decorEmojis: ["🎃", "🦇", "👻"],
  },
  thanksgiving: {
    background: "linear-gradient(160deg, #f3e3d0 0%, #f8ede0 55%, #fdf7f0 100%)",
    cardBackground: "#ffffff",
    accent: "#a85c32",
    accentSoft: "#e8cfb0",
    text: "#3a2a1a",
    textSecondary: "#8a6f52",
    chipBackground: "#e8cfb0",
    chipText: "#7a4a24",
    accentEmoji: "🍂",
    decorEmojis: ["🍂", "🍁", "🦃"],
  },
  winter_holiday: {
    background: "linear-gradient(160deg, #f7e3e3 0%, #fbeeee 55%, #fdf7f5 100%)",
    cardBackground: "#ffffff",
    accent: "#c23b3b",
    accentSoft: "#f0cccc",
    text: "#2e2020",
    textSecondary: "#7a6060",
    chipBackground: "#d7e8d9",
    chipText: "#2f6b4f",
    accentEmoji: "❄️",
    decorEmojis: ["❄️", "✨"],
  },
  valentines_day: {
    background: "linear-gradient(160deg, #fbe1ea 0%, #fdedf2 55%, #fef7fa 100%)",
    cardBackground: "#ffffff",
    accent: "#e0527a",
    accentSoft: "#f8d3e0",
    text: "#3a2430",
    textSecondary: "#8a6b78",
    chipBackground: "#f8d3e0",
    chipText: "#c23864",
    accentEmoji: "💕",
    decorEmojis: ["💕", "💗"],
  },
  july_fourth: {
    background: "linear-gradient(160deg, #dde6f5 0%, #eef2fa 55%, #f8fafd 100%)",
    cardBackground: "#ffffff",
    accent: "#3355a4",
    accentSoft: "#cdd8ef",
    text: "#1f2a3f",
    textSecondary: "#5c6a80",
    chipBackground: "#cdd8ef",
    chipText: "#2a4488",
    accentEmoji: "⭐",
    decorEmojis: ["⭐", "🎆"],
  },
};

// Fixed scatter layout (percentage-based position, rotation, size, opacity)
// for the background splash -- reused across every theme so only the
// emoji + color change, not the composition. Enough spread to read as a
// full background, not just a couple of corner accents.
const SPLASH_POSITIONS: Array<{
  top: string;
  left: string;
  rotate: number;
  remSize: number;
  opacity: number;
}> = [
  { top: "4%", left: "6%", rotate: -18, remSize: 3.2, opacity: 0.16 },
  { top: "8%", left: "82%", rotate: 15, remSize: 2.6, opacity: 0.14 },
  { top: "24%", left: "-2%", rotate: 8, remSize: 2.2, opacity: 0.12 },
  { top: "20%", left: "94%", rotate: -12, remSize: 3, opacity: 0.15 },
  { top: "42%", left: "4%", rotate: 22, remSize: 2, opacity: 0.13 },
  { top: "48%", left: "90%", rotate: -20, remSize: 2.8, opacity: 0.14 },
  { top: "65%", left: "-1%", rotate: 12, remSize: 2.4, opacity: 0.12 },
  { top: "70%", left: "88%", rotate: -8, remSize: 2.6, opacity: 0.13 },
  { top: "85%", left: "10%", rotate: 18, remSize: 2.2, opacity: 0.15 },
  { top: "90%", left: "78%", rotate: -15, remSize: 3, opacity: 0.12 },
];

function themeFor(key: string): ThemeStyle {
  return THEMES[key] ?? THEMES.wagzly_classic;
}

function formatExpiry(expiresAt: string | null): string {
  if (!expiresAt) return "";
  try {
    const d = new Date(expiresAt);
    return d.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
  } catch {
    return "";
  }
}

export default function ReportCardPage() {
  const params = useParams<{ shortId: string }>();
  const shortId = String(params.shortId ?? "");

  const [loading, setLoading] = useState(true);
  const [errorKind, setErrorKind] = useState<"not_found" | "expired" | "unknown" | null>(null);
  const [report, setReport] = useState<ReportData | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch(`/api/reports/${shortId}`);

        if (response.status === 404) {
          if (!cancelled) setErrorKind("not_found");
          return;
        }

        if (response.status === 410) {
          if (!cancelled) setErrorKind("expired");
          return;
        }

        if (!response.ok) {
          if (!cancelled) setErrorKind("unknown");
          return;
        }

        const data = (await response.json()) as ReportData;
        if (!cancelled) setReport(data);
      } catch {
        if (!cancelled) setErrorKind("unknown");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [shortId]);

  if (loading) {
    return (
      <div style={{ background: THEMES.wagzly_classic.background }} className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#c58fa1] border-t-transparent" />
          <p className="text-sm font-medium text-[#7a6b74]">Loading report card...</p>
        </div>
      </div>
    );
  }

  if (errorKind || !report) {
    const isExpired = errorKind === "expired";
    return (
      <div style={{ background: THEMES.wagzly_classic.background }} className="flex min-h-screen items-center justify-center p-6">
        <div className="max-w-sm rounded-[24px] bg-white p-8 text-center shadow-[0_20px_50px_rgba(46,36,48,0.12)]">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#f7e6ec] text-3xl">
            {isExpired ? "\u{1F570}\u{FE0F}" : "\u{1F43E}"}
          </div>
          <h1 className="text-xl font-bold text-[#2e2430]">
            {isExpired ? "This report has expired" : "Report not found"}
          </h1>
          <p className="mt-2 text-sm text-[#7a6b74]">
            {isExpired
              ? "Grooming report links are only available for 3 days after they're sent. Reach out to your groomer if you'd like another copy."
              : "This link doesn't match a report card we can find. Double-check the link, or reach out to your groomer."}
          </p>
        </div>
      </div>
    );
  }

  const theme = themeFor(report.theme);
  const expiryText = formatExpiry(report.expires_at);
  const hasBothPhotos = report.before_photo_url && report.after_photo_url;
  const decorEmojis = theme.decorEmojis ?? (theme.accentEmoji ? [theme.accentEmoji] : []);

  return (
    <div
      style={{ background: theme.background }}
      className="relative min-h-screen overflow-hidden px-4 py-10 sm:px-6"
    >
      {/* Soft blurred color blobs behind everything -- gives the
          background real depth/"splash" instead of a flat gradient. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full sm:h-96 sm:w-96"
        style={{ backgroundColor: theme.accent, opacity: 0.16, filter: "blur(70px)" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 -right-16 h-80 w-80 rounded-full sm:h-[26rem] sm:w-[26rem]"
        style={{ backgroundColor: theme.accent, opacity: 0.14, filter: "blur(90px)" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute right-1/4 top-1/3 h-56 w-56 rounded-full"
        style={{ backgroundColor: theme.accentSoft, opacity: 0.22, filter: "blur(60px)" }}
      />

      {/* Scattered themed icons across the whole page -- the actual
          "splash art" -- cycling through each theme's 2-3 decorEmojis at
          fixed positions/rotations/opacities so it reads as an organic
          background pattern rather than a repeated grid. */}
      {decorEmojis.length > 0 &&
        SPLASH_POSITIONS.map((pos, index) => (
          <div
            key={index}
            aria-hidden
            className="pointer-events-none absolute select-none leading-none"
            style={{
              top: pos.top,
              left: pos.left,
              fontSize: `${pos.remSize}rem`,
              opacity: pos.opacity,
              transform: `rotate(${pos.rotate}deg)`,
            }}
          >
            {decorEmojis[index % decorEmojis.length]}
          </div>
        ))}

      <div className="relative mx-auto max-w-lg">
        {/* Business header */}
        <div className="mb-5 flex items-center justify-center gap-2">
          {report.business_logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={report.business_logo_url}
              alt={report.business_name}
              className="h-8 w-8 rounded-full object-cover"
            />
          ) : null}
          <span className="text-sm font-semibold tracking-wide" style={{ color: theme.textSecondary }}>
            {report.business_name}
          </span>
          {theme.accentEmoji ? <span className="text-sm">{theme.accentEmoji}</span> : null}
        </div>

        <div
          className="overflow-hidden rounded-[28px] shadow-[0_24px_60px_rgba(0,0,0,0.10)]"
          style={{ backgroundColor: theme.cardBackground }}
        >
          {/* Colored accent bar -- gives each theme a distinct identity
              at a glance, even before reading anything on the card. */}
          <div className="h-2" style={{ backgroundColor: theme.accent }} />

          {/* Pet header */}
          <div className="flex flex-col items-center px-6 pb-2 pt-8 text-center">
            {report.pet_image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={report.pet_image_url}
                alt={report.pet_name}
                className="h-24 w-24 rounded-full border-4 object-cover"
                style={{ borderColor: theme.accentSoft }}
              />
            ) : (
              <div
                className="flex h-24 w-24 items-center justify-center rounded-full border-4 text-4xl"
                style={{ borderColor: theme.accentSoft, backgroundColor: theme.accentSoft }}
              >
                🐾
              </div>
            )}
            <h1 className="mt-4 text-2xl font-extrabold" style={{ color: theme.text }}>
              {report.pet_name}'s Grooming Report
            </h1>
            {report.pet_breed ? (
              <p className="mt-1 text-sm" style={{ color: theme.textSecondary }}>
                {report.pet_breed}
              </p>
            ) : null}
          </div>

          {/* Before / After showcase */}
          {(report.before_photo_url || report.after_photo_url) && (
            <div className="px-6 pt-6">
              <div className={hasBothPhotos ? "grid grid-cols-2 gap-3" : "grid grid-cols-1"}>
                {report.before_photo_url ? (
                  <div className="overflow-hidden rounded-[18px]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={report.before_photo_url}
                      alt="Before"
                      className="aspect-square w-full object-cover"
                    />
                    <div
                      className="py-1.5 text-center text-xs font-bold uppercase tracking-wide"
                      style={{ backgroundColor: theme.accentSoft, color: theme.accent }}
                    >
                      Before
                    </div>
                  </div>
                ) : null}
                {report.after_photo_url ? (
                  <div className="overflow-hidden rounded-[18px]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={report.after_photo_url}
                      alt="After"
                      className="aspect-square w-full object-cover"
                    />
                    <div
                      className="py-1.5 text-center text-xs font-bold uppercase tracking-wide"
                      style={{ backgroundColor: theme.accent, color: theme.cardBackground }}
                    >
                      After
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          )}

          {/* Headline */}
          {report.headline ? (
            <div className="px-6 pt-6 text-center">
              <p className="text-lg font-bold" style={{ color: theme.accent }}>
                {report.headline}
              </p>
            </div>
          ) : null}

          {/* Mood tags */}
          {report.tags.length > 0 ? (
            <div className="flex flex-wrap justify-center gap-2 px-6 pt-4">
              {report.tags.map((tag) => (
                <span
                  key={tag.id}
                  className="rounded-full px-3 py-1.5 text-sm font-semibold"
                  style={{ backgroundColor: theme.chipBackground, color: theme.chipText }}
                >
                  {tag.label} {tag.emoji ?? ""}
                </span>
              ))}
            </div>
          ) : null}

          {/* Note */}
          {report.note ? (
            <div className="px-6 pb-2 pt-5">
              <p className="whitespace-pre-wrap text-center text-[15px] leading-relaxed" style={{ color: theme.text }}>
                {report.note}
              </p>
            </div>
          ) : null}

          {/* Footer */}
          <div className="mt-6 border-t px-6 py-5 text-center" style={{ borderColor: theme.accentSoft }}>
            <p className="text-xs" style={{ color: theme.textSecondary }}>
              Sent by {report.business_name}
            </p>
            {expiryText ? (
              <p className="mt-1 text-xs" style={{ color: theme.textSecondary }}>
                This report is available through {expiryText}.
              </p>
            ) : null}
            <p className="mt-3 text-[11px] font-medium tracking-wide" style={{ color: theme.textSecondary }}>
              Powered by Wagzly 🐾
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
