-- CreateTable
CREATE TABLE "PolicyTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "blockedDomains" TEXT NOT NULL DEFAULT '[]',
    "allowedApps" TEXT NOT NULL DEFAULT '[]',
    "screenshotInterval" INTEGER NOT NULL DEFAULT 60000,
    "kioskMode" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
