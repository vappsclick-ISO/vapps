-- Performance indexes for sites and processes queries
-- These indexes significantly improve query performance for:
-- 1. Sites endpoint (sites with processes)
-- 2. Processes endpoint (filtered by siteId)

-- NOTE: sites(id) is a PRIMARY KEY, so it's already indexed automatically
-- No need to create an index on sites(id)

-- Index on processes.siteId for JOIN and WHERE clause performance
CREATE INDEX IF NOT EXISTS idx_processes_siteId ON processes("siteId");

-- Index on processes.createdAt for ORDER BY performance
CREATE INDEX IF NOT EXISTS idx_processes_createdAt ON processes("createdAt" DESC);

-- Composite index for common query pattern: siteId + createdAt
CREATE INDEX IF NOT EXISTS idx_processes_siteId_createdAt ON processes("siteId", "createdAt" DESC);

-- Index on sites.createdAt for ORDER BY performance
CREATE INDEX IF NOT EXISTS idx_sites_createdAt ON sites("createdAt" ASC);

-- Index on processes.name for ORDER BY name (used in sites query)
CREATE INDEX IF NOT EXISTS idx_processes_name ON processes(name ASC);
