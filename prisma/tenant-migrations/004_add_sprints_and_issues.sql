-- Add Sprints and Issues tables for task management
-- This migration adds tables for sprints and issues/tasks within processes

-- Sprints table
CREATE TABLE IF NOT EXISTS "sprints" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "processId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "sprints_processId_fkey" FOREIGN KEY ("processId") REFERENCES "processes"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Issues/Tasks table
CREATE TABLE IF NOT EXISTS "issues" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL, -- Issue title/type (Bug, Feature, Task, etc.)
    "description" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "status" TEXT NOT NULL DEFAULT 'to-do',
    "points" INTEGER DEFAULT 0,
    "assignee" TEXT,
    "tags" TEXT[], -- Array of tags
    "source" TEXT, -- Issue source (Employee Feedback, Customer Feedback, etc.)
    "sprintId" TEXT, -- NULL means it's in backlog
    "processId" TEXT NOT NULL,
    "order" INTEGER DEFAULT 0, -- For drag and drop ordering
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "issues_sprintId_fkey" FOREIGN KEY ("sprintId") REFERENCES "sprints"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "issues_processId_fkey" FOREIGN KEY ("processId") REFERENCES "processes"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS "idx_sprints_processId" ON "sprints"("processId");
CREATE INDEX IF NOT EXISTS "idx_issues_processId" ON "issues"("processId");
CREATE INDEX IF NOT EXISTS "idx_issues_sprintId" ON "issues"("sprintId");
CREATE INDEX IF NOT EXISTS "idx_issues_status" ON "issues"("status");
