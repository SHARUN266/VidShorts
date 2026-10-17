const { createClient } = require("@libsql/client");
const path = require("path");

const dbPath = path.join(process.cwd(), "data", "vidshot.db");
const client = createClient({
  url: `file:${dbPath}`,
});

async function test() {
  console.log("🔍 Checking SQLite database file connection...");
  try {
    const res = await client.execute("SELECT * FROM caption_styles");
    console.log("✅ Database connection successful!");
    console.log("🎉 Seeded caption styles retrieved successfully:");
    res.rows.forEach(row => {
      console.log(`  • ID: ${row.id} | Name: ${row.name} | Properties: ${row.style_properties}`);
    });
  } catch (e) {
    console.error("❌ Database connection failed:", e);
  }
  process.exit(0);
}

test();
