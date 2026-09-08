import type { Metadata } from "next";
import localFont from "next/font/local";
import { JetBrains_Mono } from "next/font/google";
import "@rogieking/figui3/fig.css";
import "@rogieking/figui3/fig-editor.css";
import "@rogieking/figui3/fig-lab.css";
import "./fonts/MacFont/stylesheet.css";
import "./globals.css";

const macFont = localFont({
  src: [
    {
      path: "./fonts/MacFont/fonts/BlinkMacSystemFont-Thin.woff2",
      weight: "100",
      style: "normal",
    },
    {
      path: "./fonts/MacFont/fonts/BlinkMacSystemFont-ThinItalic.woff2",
      weight: "100",
      style: "italic",
    },
    {
      path: "./fonts/MacFont/fonts/BlinkMacSystemFont-Ultralight.woff2",
      weight: "200",
      style: "normal",
    },
    {
      path: "./fonts/MacFont/fonts/BlinkMacSystemFont-UltralightItalic.woff2",
      weight: "200",
      style: "italic",
    },
    {
      path: "./fonts/MacFont/fonts/BlinkMacSystemFont-Light.woff2",
      weight: "300",
      style: "normal",
    },
    {
      path: "./fonts/MacFont/fonts/BlinkMacSystemFont-LightItalic.woff2",
      weight: "300",
      style: "italic",
    },
    {
      path: "./fonts/MacFont/fonts/BlinkMacSystemFont-Regular.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "./fonts/MacFont/fonts/BlinkMacSystemFont-RegularItalic.woff2",
      weight: "400",
      style: "italic",
    },
    {
      path: "./fonts/MacFont/fonts/BlinkMacSystemFont-Medium.woff2",
      weight: "500",
      style: "normal",
    },
    {
      path: "./fonts/MacFont/fonts/BlinkMacSystemFont-MediumItalic.woff2",
      weight: "500",
      style: "italic",
    },
    {
      path: "./fonts/MacFont/fonts/BlinkMacSystemFont-Semibold.woff2",
      weight: "600",
      style: "normal",
    },
    {
      path: "./fonts/MacFont/fonts/BlinkMacSystemFont-SemiboldItalic.woff2",
      weight: "600",
      style: "italic",
    },
    {
      path: "./fonts/MacFont/fonts/BlinkMacSystemFont-Bold.woff2",
      weight: "700",
      style: "normal",
    },
    {
      path: "./fonts/MacFont/fonts/BlinkMacSystemFont-BoldItalic.woff2",
      weight: "700",
      style: "italic",
    },
    {
      path: "./fonts/MacFont/fonts/BlinkMacSystemFont-Heavy.woff2",
      weight: "800",
      style: "normal",
    },
    {
      path: "./fonts/MacFont/fonts/BlinkMacSystemFont-HeavyItalic.woff2",
      weight: "800",
      style: "italic",
    },
    {
      path: "./fonts/MacFont/fonts/BlinkMacSystemFont-Black.woff2",
      weight: "900",
      style: "normal",
    },
    {
      path: "./fonts/MacFont/fonts/BlinkMacSystemFont-BlackItalic.woff2",
      weight: "900",
      style: "italic",
    },
  ],
  variable: "--font-sans",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "OrderFlow Chart",
  description: "Personal, minimal order flow charting tool",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`dark ${macFont.variable} ${jetbrainsMono.variable}`}>
      <body
        className={`${macFont.className} antialiased bg-background text-main`}
      >
        {children}
      </body>
    </html>
  );
}
