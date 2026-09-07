export const BRAND = {
  name: "cuciyan",
  displayName: "CUCIYAN",

  tagline: "Semua Bersih, Semua Beres.",

  positioning: "Super App untuk Semua Kebutuhan Cucian",

  personality: [
    "friendly",
    "modern",
    "clean",
    "trustworthy",
    "digital-first",
    "scalable",
  ],

  colors: {
    primary: "#0B4D91",
    secondary: "#00B3E6",
    accent: "#14CBA8",
    support: "#7ED957",
    neutral: {
      background: "#F8F7FF",
      surface: "#F4F9FF",
      text: "#1F2937",
      textSecondary: "#6B7280",
    },
  },
} as const;

export type BrandConfig = typeof BRAND;
