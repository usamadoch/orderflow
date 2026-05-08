import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: 'class',
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular"],
      },
      colors: {
        background: "var(--bg-base)",

        surface: "var(--bg-surface)",
        border: "var(--border)",
        "text-muted": "var(--text-muted)",
        "text-dim": "var(--text-dim)",
        "text-main": "var(--text-main)",
        bull: "var(--bull)",
        bear: "var(--bear)",
        accent: "var(--accent)",
      },
    },
  },
  plugins: [],
};
export default config;
