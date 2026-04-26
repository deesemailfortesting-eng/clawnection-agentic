import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0a0a0b",
          borderRadius: 8,
        }}
      >
        <span style={{ color: "#fe3c72", fontSize: 18, fontWeight: 700 }}>W</span>
      </div>
    ),
    { ...size },
  );
}
