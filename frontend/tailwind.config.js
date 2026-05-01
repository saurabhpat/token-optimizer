/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        surface: "#FFFFFF",
        primary: "#2563EB",
        border: "#E2E8F0",
        ink: "#0F172A",
        muted: "#475569",
        soft: "#F8FAFC",
        success: "#0F766E",
        warning: "#EA580C"
      },
      boxShadow: {
        panel: "0 18px 36px -24px rgba(15, 23, 42, 0.22)",
        soft: "0 10px 30px -20px rgba(37, 99, 235, 0.25)"
      },
      backgroundImage: {
        "shell-glow":
          "radial-gradient(circle at top left, rgba(37, 99, 235, 0.08), transparent 28%), radial-gradient(circle at bottom right, rgba(14, 165, 233, 0.08), transparent 24%)"
      }
    }
  },
  plugins: []
};

