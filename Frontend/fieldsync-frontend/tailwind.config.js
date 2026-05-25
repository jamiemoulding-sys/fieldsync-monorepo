/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],

  theme: {
    extend: {
      colors: {
        bg: "#020617",
        card: "#0f172a",
        border:
          "#1f2937",

        primary:
          "#6366f1",
        success:
          "#10b981",
        danger:
          "#ef4444",
        warning:
          "#f59e0b",
      },

      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "sans-serif",
        ],
      },

      borderRadius: {
        xl2: "1rem",
        xl3: "1.5rem",
      },

      boxShadow: {
        glow: "0 0 35px rgba(99,102,241,0.25)",
        soft: "0 10px 30px rgba(0,0,0,0.25)",
      },

      backdropBlur: {
        xs: "2px",
      },

      animation: {
        float:
          "float 6s ease-in-out infinite",
        pulseSlow:
          "pulse 4s ease-in-out infinite",
      },

      keyframes: {
        float: {
          "0%,100%": {
            transform:
              "translateY(0px)",
          },
          "50%": {
            transform:
              "translateY(-8px)",
          },
        },
      },
    },
  },

  plugins: [],
};