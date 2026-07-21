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
          bg: "#F7F7FC",
          surface: "#FFFFFF",
          surfaceMuted: "#F6F3FF",
          surfaceStrong: "#EFEAFF",
          line: "#E5E1EE",
          lineStrong: "#D7D0E7",
          ink: "#181629",
          text: "#39354D",
          muted: "#706B82",
          primary: "#6D3DF5",
          primaryHover: "#592BD4",
          primarySoft: "#EEE9FF",
          primaryLine: "#CFC3FF",
          green: "#15803D",
          greenSoft: "#DCFCE7",
          amber: "#A65108",
          amberSoft: "#FEF3C7",
          red: "#DC2626",
          redSoft: "#FEE2E2",
          criterionGoodSurface: "#F7FCF7",
          criterionGoodBorder: "#D8EEDA",
          criterionAverageSurface: "#FEFAF4",
          criterionAverageBorder: "#F0DFC2",
          criterionBadSurface: "#FEF5F5",
          criterionBadBorder: "#F1D8D8"
        }
      },
      boxShadow: {
        card: "0 8px 30px rgba(54, 39, 97, 0.08)",
        floating: "0 24px 70px rgba(36, 27, 68, 0.16)",
        focus: "0 0 0 4px rgba(109, 61, 245, 0.14)"
      }
    }
  },
  plugins: []
};

export default config;
