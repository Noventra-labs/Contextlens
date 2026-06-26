/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Dark mode (default) colors
        surface: "var(--color-surface)",
        card: "var(--color-card)",
        cardBorder: "var(--color-cardBorder)",
        primary: "#4f98a3",
        primaryLight: "#7ec8c8",
        textPrimary: "var(--color-textPrimary)",
        textMuted: "var(--color-textMuted)",
        diffAdd: "#1a4023",
        diffRemove: "#4a1a1a",
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
}
