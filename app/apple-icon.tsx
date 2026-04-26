import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(145deg, #141416 0%, #0a0a0b 100%)",
          borderRadius: 36,
        }}
      >
        <span style={{ color: "#fe3c72", fontSize: 72, fontWeight: 800, letterSpacing: -2 }}>WTF</span>
        <span style={{ color: "#a1a1aa", fontSize: 22, fontWeight: 600, marginTop: 4 }}>Radar</span>
      </div>
    ),
    { ...size },
  );
}
