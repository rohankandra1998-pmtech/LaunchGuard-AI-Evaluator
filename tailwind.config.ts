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
        guard: {
          bg: "#07111f",
          panel: "#0d1a2b",
          line: "#20324a",
          cyan: "#4dd6c9",
          green: "#9be37a",
          amber: "#f4bf75",
          red: "#fb7185"
        }
      },
      boxShadow: {
        glow: "0 24px 80px rgba(77, 214, 201, 0.12)"
      }
    }
  },
  plugins: []
};

export default config;
