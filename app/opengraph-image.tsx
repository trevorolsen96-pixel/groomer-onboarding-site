import { ImageResponse } from "next/og";
import fs from "node:fs";
import path from "node:path";

export const runtime = "nodejs";
export const alt = "Wagzly | Mobile Grooming Software";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  const screenshotPath = path.join(
    process.cwd(),
    "public/images/app/screen-dashboard.png"
  );
  const logoPath = path.join(
    process.cwd(),
    "public/images/logo/WagzlyHLarge.png"
  );

  const screenshotSrc = `data:image/png;base64,${fs
    .readFileSync(screenshotPath)
    .toString("base64")}`;
  const logoSrc = `data:image/png;base64,${fs
    .readFileSync(logoPath)
    .toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          position: "relative",
          background:
            "linear-gradient(135deg, #fffdfd 0%, #fbf7f8 40%, #f0dfe8 100%)",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: -120,
            right: -100,
            width: 420,
            height: 420,
            borderRadius: 9999,
            background: "#c58fa1",
            opacity: 0.25,
            display: "flex",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: -140,
            left: -80,
            width: 360,
            height: 360,
            borderRadius: 9999,
            background: "#b9a6c8",
            opacity: 0.25,
            display: "flex",
          }}
        />

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: "0 40px 0 72px",
            width: 660,
            zIndex: 1,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logoSrc}
            width={220}
            height={62}
            alt="Wagzly"
            style={{ display: "flex" }}
          />

          <div
            style={{
              display: "flex",
              marginTop: 36,
              fontSize: 22,
              fontWeight: 700,
              letterSpacing: 3,
              textTransform: "uppercase",
              color: "#a96f84",
            }}
          >
            Mobile Grooming Software
          </div>

          <div
            style={{
              display: "flex",
              marginTop: 18,
              fontSize: 52,
              fontWeight: 800,
              lineHeight: 1.08,
              letterSpacing: -1,
              color: "#2e2430",
            }}
          >
            Run your grooming business without the chaos
          </div>

          <div
            style={{
              display: "flex",
              marginTop: 26,
              fontSize: 24,
              lineHeight: 1.5,
              color: "#7a6b74",
            }}
          >
            Scheduling, clients, reminders, and payments, all in one app.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flex: 1,
            zIndex: 1,
          }}
        >
          <div
            style={{
              display: "flex",
              borderRadius: 40,
              border: "8px solid #2e2430",
              boxShadow: "0 40px 80px rgba(46, 36, 48, 0.28)",
              overflow: "hidden",
              transform: "rotate(3deg)",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={screenshotSrc}
              width={252}
              height={560}
              alt="Wagzly dashboard"
              style={{ display: "flex" }}
            />
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
