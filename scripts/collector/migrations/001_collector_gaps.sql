-- Migration: 001_collector_gaps.sql
-- Creates the collector_gaps audit table for queryable gap records.
-- Safe to run against a live DB (IF NOT EXISTS is idempotent).
--
-- Run this once against your TimescaleDB before deploying the updated collector.
-- Example:
--   psql "$TIMESCALEDB_URL" -f scripts/collector/migrations/001_collector_gaps.sql

CREATE TABLE IF NOT EXISTS collector_gaps (
  id         BIGSERIAL PRIMARY KEY,
  source     TEXT        NOT NULL,              -- 'spot' or 'futures'
  gap_start  BIGINT,                            -- ms epoch where gap begins (lastTradeTimeMs at disconnect)
  gap_end    BIGINT,                            -- ms epoch where gap ends (Date.now() at exhaustion)
  reason     TEXT        NOT NULL DEFAULT '',   -- e.g. 'backfill_exhausted'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for querying recent gaps quickly
CREATE INDEX IF NOT EXISTS collector_gaps_created_at_idx ON collector_gaps (created_at DESC);
CREATE INDEX IF NOT EXISTS collector_gaps_source_idx     ON collector_gaps (source);
