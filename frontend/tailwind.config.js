export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["IBM Plex Sans", "Inter", "system-ui", "sans-serif"]
      },
      colors: {
        stern: {
          bg: "#020617",
          panel: "#0F172A",
          muted: "#1E293B",
          line: "#263449",
          teal: "#2DD4BF",
          blue: "#38BDF8",
          green: "#22C55E",
          warning: "#F59E0B"
        }
      },
      boxShadow: {
        glow: "0 0 28px rgba(45, 212, 191, 0.16)"
      }
    }
  },
  plugins: []
};
