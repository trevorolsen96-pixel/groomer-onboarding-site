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
};

const THEMES: Record<string, ThemeStyle> = {
  rose_petal: {
    background: "linear-gradient(160deg, #f7e6ec 0%, #fbf7f8 55%, #fdf9f5 100%)",
    cardBackground: "#ffffff",
    accent: "#c58fa1",
    accentSoft: "#f2dee5",
    text: "#2e2430",
    textSecondary: "#7a6b74",
    chipBackground: "#f7e6ec",
    chipText: "#8a5a6c",
  },
  golden_hour: {
    background: "linear-gradient(160deg, #ffe3c7 0%, #fff2df 55%, #fffaf3 100%)",
    cardBackground: "#ffffff",
    accent: "#d98a3d",
    accentSoft: "#fbe3c4",
    text: "#3a2a1a",
    textSecondary: "#8a6f52",
    chipBackground: "#fbe3c4",
    chipText: "#8a5a1f",
  },
  ocean_breeze: {
    background: "linear-gradient(160deg, #d6f0f4 0%, #eafafb 55%, #f7fdfe 100%)",
    cardBackground: "#ffffff",
    accent: "#3f97a8",
    accentSoft: "#d3eef1",
    text: "#1f3a3f",
    textSecondary: "#5c7a80",
    chipBackground: "#d3eef1",
    chipText: "#2b6c78",
  },
  minty_fresh: {
    background: "linear-gradient(160deg, #dcefd8 0%, #eef7ea 55%, #f9fbf6 100%)",
    cardBackground: "#ffffff",
    accent: "#5f9459",
    accentSoft: "#dcecd7",
    text: "#24331f",
    textSecondary: "#647a5f",
    chipBackground: "#dcecd7",
    chipText: "#436b3d",
  },
  lavender_bloom: {
    background: "linear-gradient(160deg, #e6dbf3 0%, #f2ebfa 55%, #faf6fd 100%)",
    cardBackground: "#ffffff",
    accent: "#8560ae",
    accentSoft: "#e6daf2",
    text: "#2c2438",
    textSecondary: "#786c8a",
    chipBackground: "#e6daf2",
    chipText: "#6a4a92",
  },
  midnight_paws: {
    background: "linear-gradient(160deg, #171a26 0%, #232839 55%, #2c3247 100%)",
    cardBackground: "#262b3d",
    accent: "#f0b45c",
    accentSoft: "#3a3450",
    text: "#f5f2ec",
    textSecondary: "#b7b3c4",
    chipBackground: "#33394f",
    chipText: "#f0b45c",
  },
};

function themeFor(key: string): ThemeStyle {
  return THEMES[key] ?? THEMES.rose_petal;
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
      <div style={{ background: THEMES.rose_petal.background }} className="flex min-h-screen items-center justify-center">
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
      <div style={{ background: THEMES.rose_petal.background }} className="flex min-h-screen items-center justify-center p-6">
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

  return (
    <div style={{ background: theme.background }} className="min-h-screen px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-lg">
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
        </div>

        <div
          className="overflow-hidden rounded-[28px] shadow-[0_24px_60px_rgba(0,0,0,0.10)]"
          style={{ backgroundColor: theme.cardBackground }}
        >
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
