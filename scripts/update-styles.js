const { createClient } = require("@libsql/client");
const path = require("path");

const dbPath = path.join(process.cwd(), "data", "vidshot.db");
const db = createClient({
  url: `file:${dbPath}`,
});

async function main() {
  await db.execute("UPDATE caption_styles SET is_default = 0");

  const viralStyle = {
    fontFamily: "'Lilita One', 'Montserrat', Anton, Impact, sans-serif",
    fontSizePx: 64,
    textColor: "#FFFFFF",
    highlightColor: "#FFE600",
    backgroundColor: "#FFE600",
    textStroke: "7px #000000",
    badgeStyle: "box",
    activeAnimation: "hormozi-pop",
    textPosition: "center",
    maxDisplayWords: 3,
  };

  await db.execute({
    sql: "UPDATE caption_styles SET is_default = 1, style_properties = ? WHERE id = ?",
    args: [JSON.stringify(viralStyle), "hormozi-viral"],
  });

  const res = await db.execute("SELECT id, name, is_default, style_properties FROM caption_styles WHERE is_default = 1");
  console.log("Default style successfully updated:", res.rows);
}

main().catch(console.error);
