"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

export function Qr({ value, className = "" }: { value: string; className?: string }) {
  const [svg, setSvg] = useState<string>("");
  useEffect(() => {
    QRCode.toString(value, {
      type: "svg",
      margin: 0,
      errorCorrectionLevel: "M",
      color: { dark: "#1f1c25", light: "#ffffff00" },
    }).then(setSvg);
  }, [value]);
  return (
    <div
      className={`[&>svg]:h-full [&>svg]:w-full ${className}`}
      aria-label={`QR kód: ${value}`}
      role="img"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

export async function downloadQrPng(value: string, filename: string) {
  const url = await QRCode.toDataURL(value, {
    width: 1600,
    margin: 2,
    errorCorrectionLevel: "M",
    color: { dark: "#1f1c25", light: "#ffffff" },
  });
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
}
