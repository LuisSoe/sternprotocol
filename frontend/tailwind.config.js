export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Fira Sans", "system-ui", "sans-serif"],
        mono: ["Fira Code", "ui-monospace", "SFMono-Regular", "monospace"]
      },
      colors: {
        ink: {
          950: "#0B0F14",
          900: "#10151C",
          850: "#141A22",
          800: "#171E27",
          700: "#232C37",
          600: "#33404E"
        },
        paper: {
          DEFAULT: "#E8EDF2",
          dim: "#93A1B0",
          faint: "#5C6B7A"
        },
        brass: {
          300: "#FBCB6B",
          400: "#F5B84C",
          500: "#E8A32E",
          600: "#C4861F"
        },
        state: {
          ok: "#3DD68C",
          fail: "#F26D78",
          warn: "#E8A32E",
          info: "#5CB3E4"
        }
      },
      fontSize: {
        "2xs": ["0.6875rem", { lineHeight: "1rem" }]
      }
    }
  },
  plugins: []
};
