import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#0f172a",
        mist: "#f8fafc",
        accent: "#0f766e",
        sand: "#f5efe6",
        line: "#dbe4ea"
      },
      boxShadow: {
        panel: "0 18px 45px -24px rgba(15, 23, 42, 0.3)"
      },
      fontFamily: {
        sans: ["Avenir Next", "ui-sans-serif", "system-ui", "sans-serif"]
      }
    }
  },
  plugins: []
};

export default config;
