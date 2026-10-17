import { db } from "./drizzle";
import { captionStyles } from "./schema";

const defaultStyles = [
  {
    id: "modern-yellow",
    name: "Modern Yellow",
    styleProperties: {
      fontFamily: "Impact",
      fontSizePx: 64,
      textColor: "#FFFFFF",
      highlightColor: "#FFFF00",
      backgroundColor: "#000000",
      textPosition: "center",
      maxDisplayWords: 3,
    },
    isDefault: true,
  },
  {
    id: "bold-white",
    name: "Bold White",
    styleProperties: {
      fontFamily: "Arial Black",
      fontSizePx: 60,
      textColor: "#FFFFFF",
      highlightColor: "#FFFFFF",
      backgroundColor: "#000000",
      textPosition: "center",
      maxDisplayWords: 4,
    },
    isDefault: false,
  },
  {
    id: "neon-glow",
    name: "Neon Glow",
    styleProperties: {
      fontFamily: "Trebuchet MS",
      fontSizePx: 56,
      textColor: "#00FFFF",
      highlightColor: "#FF00FF",
      backgroundColor: "#111111",
      textPosition: "bottom",
      maxDisplayWords: 3,
    },
    isDefault: false,
  },
];

async function seed() {
  console.log("Seeding default caption styles...");
  for (const style of defaultStyles) {
    try {
      await db.insert(captionStyles).values({
        id: style.id,
        name: style.name,
        styleProperties: style.styleProperties,
        isDefault: style.isDefault,
      }).onConflictDoNothing();
      console.log(`- Seeded style: ${style.name}`);
    } catch (e) {
      console.error(`- Error seeding style ${style.name}:`, e);
    }
  }
  console.log("Seeding complete!");
  process.exit(0);
}

seed();
