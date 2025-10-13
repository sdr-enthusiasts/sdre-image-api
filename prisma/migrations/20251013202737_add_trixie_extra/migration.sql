-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Images" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "url_trixie" TEXT NOT NULL DEFAULT '',
    "modified_date" DATETIME NOT NULL,
    "created_date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tag" TEXT NOT NULL,
    "tag_trixie" TEXT NOT NULL DEFAULT '',
    "release_notes" TEXT NOT NULL,
    "stable" BOOLEAN NOT NULL,
    "is_pinned_version" BOOLEAN NOT NULL
);
INSERT INTO "new_Images" ("created_date", "id", "is_pinned_version", "modified_date", "name", "release_notes", "stable", "tag", "url", "url_trixie") SELECT "created_date", "id", "is_pinned_version", "modified_date", "name", "release_notes", "stable", "tag", "url", "url_trixie" FROM "Images";
DROP TABLE "Images";
ALTER TABLE "new_Images" RENAME TO "Images";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
