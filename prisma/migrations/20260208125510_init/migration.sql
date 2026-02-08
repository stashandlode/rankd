-- CreateTable
CREATE TABLE "users" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "username" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'user',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "companies" (
    "place_id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "url" TEXT,
    "is_our_company" BOOLEAN NOT NULL DEFAULT false,
    "services" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "company_groups" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "company_ids" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "reviews" (
    "review_id" TEXT NOT NULL PRIMARY KEY,
    "place_id" TEXT NOT NULL,
    "author" TEXT,
    "rating" INTEGER NOT NULL,
    "review_text" TEXT,
    "review_date" DATETIME,
    "has_response" BOOLEAN NOT NULL DEFAULT false,
    "response_text" TEXT,
    "scraped_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "reviews_place_id_fkey" FOREIGN KEY ("place_id") REFERENCES "companies" ("place_id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "review_metadata" (
    "place_id" TEXT NOT NULL PRIMARY KEY,
    "total_reviews" INTEGER,
    "scraped_reviews" INTEGER,
    "calculated_avg" REAL,
    "last_scraped" DATETIME,
    CONSTRAINT "review_metadata_place_id_fkey" FOREIGN KEY ("place_id") REFERENCES "companies" ("place_id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "comparison_snapshots" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "comparison_name" TEXT NOT NULL,
    "rankings" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");
