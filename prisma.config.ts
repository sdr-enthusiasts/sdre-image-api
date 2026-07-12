import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    // `prisma generate` doesn't need a real connection, but config
    // evaluation is eager, so fall back to a placeholder when unset
    // (e.g. during the Docker build step, before DATABASE_URL is set).
    url: process.env.DATABASE_URL || "file:./prisma/dev.db",
  },
});
