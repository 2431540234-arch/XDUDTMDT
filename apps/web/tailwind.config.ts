import type { Config } from "tailwindcss";
import { theme as brandTheme } from "./src/styles/theme";

const config: Config = {
  content: ["./src/app/**/*.{ts,tsx}", "./src/components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: brandTheme.colors.primary,
        "primary-dark": brandTheme.colors.primaryDark,
        accent: brandTheme.colors.accent,
        heading: brandTheme.colors.heading,
        cream: brandTheme.colors.cream,
        ink: brandTheme.colors.ink,
      },
    },
  },
  plugins: [],
};

export default config;
