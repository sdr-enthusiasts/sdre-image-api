-- CreateTable
CREATE TABLE "LastUpdated" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "time" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Images" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "modified_date" DATETIME NOT NULL,
    "created_date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tag" TEXT NOT NULL,
    "release_notes" TEXT NOT NULL,
    "stable" BOOLEAN NOT NULL,
    "is_pinned_version" BOOLEAN NOT NULL
);
