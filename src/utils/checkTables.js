require("../utils/env");
const { db } = require("../config");

async function main() {
  console.log("Checking database tables...");
  try {
    await db.authenticate();
    console.log("Connected to database");

    const tables = await db.query(
      `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `,
      { type: db.QueryTypes.SELECT },
    );

    console.log("\nExisting tables:");
    tables.forEach((t) => console.log(`  - ${t.table_name}`));

    const menuGroupsExist = tables.some((t) => t.table_name === "menu_groups");
    const menuItemsExist = tables.some((t) => t.table_name === "menu_items");

    console.log(`\nmenu_groups exists: ${menuGroupsExist}`);
    console.log(`menu_items exists: ${menuItemsExist}`);

    if (!menuGroupsExist) {
      console.log("\nCreating menu_groups table...");
      await db.query(`
        CREATE TABLE IF NOT EXISTS menu_groups (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          label VARCHAR(255) NOT NULL,
          icon VARCHAR(255) NOT NULL,
          path VARCHAR(255),
          "sortOrder" INTEGER DEFAULT 0,
          "isActive" BOOLEAN DEFAULT true,
          "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `);
      console.log("menu_groups table created!");
    }

    if (!menuItemsExist) {
      console.log("\nCreating menu_items table...");
      await db.query(`
        CREATE TABLE IF NOT EXISTS menu_items (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          "menuGroupId" UUID NOT NULL REFERENCES menu_groups(id) ON DELETE CASCADE,
          label VARCHAR(255) NOT NULL,
          path VARCHAR(255),
          icon VARCHAR(255),
          "requiredPermission" VARCHAR(255),
          "sortOrder" INTEGER DEFAULT 0,
          "isActive" BOOLEAN DEFAULT true,
          "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `);
      console.log("menu_items table created!");
    }

    console.log("\nAll tables verified!");
    process.exit(0);
  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  }
}

main();
