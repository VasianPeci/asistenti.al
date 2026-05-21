/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#FAFAF7",
        page: "#DDDBD4",
        surface: "#F5F4EF",
        soft: "#F0F0ED",
        border: "#E4E4E0",
        fg: "#1A1A1A",
        gray: {
          DEFAULT: "#6B6B6B",
          muted: "#AAAAAA",
        },
        accent: {
          DEFAULT: "#C8102E",
          soft: "rgba(200,16,46,0.12)",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      borderRadius: {
        pill: "999px",
      },
      boxShadow: {
        card: "0 1px 2px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.04)",
      },
      animation: {
        "fade-up": "fadeUp 0.3s ease-out both",
      },
    },
  },
  plugins: [],
};
