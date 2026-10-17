const { createClient } = require("@libsql/client");
const path = require("path");

const dbPath = path.join(process.cwd(), "data", "vidshot.db");
const client = createClient({
  url: `file:${dbPath}`,
});

const defaultStyles = [
  {
    id: "modern-yellow",
    name: "Modern Yellow (Alex Hormozi)",
    styleProperties: JSON.stringify({
      fontFamily: "Impact, Arial Black, sans-serif",
      fontSizePx: 64,
      textColor: "#FFFFFF",
      highlightColor: "#EAB308",
      backgroundColor: "transparent",
      textPosition: "center",
      maxDisplayWords: 3,
    }),
    isDefault: 1,
  },
  {
    id: "bold-white",
    name: "Bold White (Minimalist)",
    styleProperties: JSON.stringify({
      fontFamily: "Montserrat, Arial Black, sans-serif",
      fontSizePx: 60,
      textColor: "#A1A1AA",
      highlightColor: "#FFFFFF",
      backgroundColor: "transparent",
      textPosition: "center",
      maxDisplayWords: 3,
    }),
    isDefault: 0,
  },
  {
    id: "mrbeast-thunder",
    name: "MrBeast Thunder (High Energy)",
    styleProperties: JSON.stringify({
      fontFamily: "Impact, sans-serif",
      fontSizePx: 64,
      textColor: "#FACC15",
      highlightColor: "#38BDF8",
      backgroundColor: "transparent",
      textPosition: "bottom",
      maxDisplayWords: 3,
    }),
    isDefault: 0,
  },
  {
    id: "neon-glow",
    name: "Neon Cyberpunk (Cyan Glow)",
    styleProperties: JSON.stringify({
      fontFamily: "Trebuchet MS, sans-serif",
      fontSizePx: 58,
      textColor: "#F472B6",
      highlightColor: "#22D3EE",
      backgroundColor: "transparent",
      textPosition: "center",
      maxDisplayWords: 3,
    }),
    isDefault: 0,
  },
  {
    id: "emerald-punch",
    name: "Emerald Punch (Viral Green)",
    styleProperties: JSON.stringify({
      fontFamily: "Arial Black, sans-serif",
      fontSizePx: 60,
      textColor: "#FFFFFF",
      highlightColor: "#10B981",
      backgroundColor: "transparent",
      textPosition: "center",
      maxDisplayWords: 3,
    }),
    isDefault: 0,
  },
  {
    id: "sunset-fire",
    name: "Sunset Fire (Red Flame)",
    styleProperties: JSON.stringify({
      fontFamily: "Impact, sans-serif",
      fontSizePx: 64,
      textColor: "#F97316",
      highlightColor: "#EF4444",
      backgroundColor: "transparent",
      textPosition: "center",
      maxDisplayWords: 3,
    }),
    isDefault: 0,
  },
  {
    id: "purple-haze",
    name: "Purple Haze (Vaporwave)",
    styleProperties: JSON.stringify({
      fontFamily: "Impact, sans-serif",
      fontSizePx: 62,
      textColor: "#38BDF8",
      highlightColor: "#A855F7",
      backgroundColor: "transparent",
      textPosition: "center",
      maxDisplayWords: 3,
    }),
    isDefault: 0,
  },
  {
    id: "vox-clean",
    name: "Vox Explainer (Top Position)",
    styleProperties: JSON.stringify({
      fontFamily: "Helvetica Neue, Helvetica, Arial, sans-serif",
      fontSizePx: 56,
      textColor: "#E4E4E7",
      highlightColor: "#FDE047",
      backgroundColor: "transparent",
      textPosition: "top",
      maxDisplayWords: 4,
    }),
    isDefault: 0,
  },
  {
    id: "golden-luxury",
    name: "Golden Luxury (Gold Accent)",
    styleProperties: JSON.stringify({
      fontFamily: "Georgia, serif",
      fontSizePx: 56,
      textColor: "#FFFFFF",
      highlightColor: "#F59E0B",
      backgroundColor: "transparent",
      textPosition: "center",
      maxDisplayWords: 3,
    }),
    isDefault: 0,
  },
];

async function seed() {
  console.log("Seeding expanded 9 viral caption styles...");
  for (const style of defaultStyles) {
    try {
      await client.execute({
        sql: "INSERT OR REPLACE INTO caption_styles (id, name, style_properties, is_default, created_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)",
        args: [style.id, style.name, style.styleProperties, style.isDefault],
      });
      console.log(`- Seeded style: ${style.name}`);
    } catch (e) {
      console.error(`- Error seeding style ${style.name}:`, e);
    }
  }
  console.log("Seeding complete!");
  process.exit(0);
}

seed();
