# REFAC_CTX_STATE

[TGT] client-side inline types -> /types
[SRC] components, hooks, lib
[MODE] strict domain type extraction, skip purely local Props if not shared (implied by lack of response, focus on domain models)

## EXTRACTION MAP (EXT_MAP)
- [x] StorageManager -> types/storage (StorageDay, DatabaseInfo, DatabasesInfo)
- [x] FeedProvider -> types/feed (TradeSource, FootprintWorkReason, FootprintWorkNeed, RawTradeHydrationStats, FootprintHistoryRow, FootprintRestoreRange, FootprintHydrationStats, FineProfileHydrationStats, AggregateBubbleStorageThresholds, AggregateBubbleHydrationStats)
- [x] profileEngine/Cache -> types/volumeProfile (VolumeProfileCacheKeyParts, VolumeProfileBuildRequest, FineProfileRow, VolumeProfileSource, FineProfileRowSnapshot, FineRowInsertResult, ProfileRow, VolumeProfile)
- [x] chart/chartRuntime -> types/chart (ChartMode, PanelId, LayoutMode, AbsorptionSide, ExhaustionSide, LineDrawMode, DrawingStrokeWidth, SessionId, CvdMode, CvdResetMode, PanelRuntimeState, TradingRuntimeStatus, ChartRuntimeState, ChartEngineContextValue)
- [x] drawCvd/CvdPanel/delta -> types/cvd (CvdScale, CvdDragMode, CvdPoint, CvdDivergenceDirection, CvdDivergenceMarker)
- [ ] debugPanel/drawVolumeBars -> types/debug (DebugPanelSnapshot, DebugTab, VolumeBarsDebugSnapshot)
- [x] FeedProvider -> lib/config/constants (magic constants extraction)
## PENDING FIXUPS (FIX_REQ)
- import paths inside components/lib after type extraction

## LOGS (EVT)
- [x] [2026-08-22] Extracted type definitions to `types/`
- [x] [2026-08-22] Extracted constants to `lib/config/constants.ts`
- [x] [2026-08-22] Extracted FeedProvider utilities to `lib/utils/feedUtils.ts` and ordered imports
