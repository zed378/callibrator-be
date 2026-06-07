require("../utils/env");
const migrate = require("../config/migrate");

async function main() {
  console.log("Running database migration...");
  await migrate.Up();
  console.log("Migration completed!");
  process.exit(0);
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
