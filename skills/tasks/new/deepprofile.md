





I want a rendering-only improvement for the Volume Profile visual style.

Do not change any calculations, storage, caching, restore logic, or data structure.
Do not change Volume Profile values.
Do not change delta calculation or delta rendering.
This task is only about the visual rendering of the total volume side of the Volume Profile.

Goal:
Make the total volume profile look like a professional filled horizontal volume histogram / auction profile shape, similar to DeepCharts / TradingView-style Volume Profile.

The profile should visually read as a continuous distribution shape so users can clearly identify:

- POC / Point of Control
- Value Area
- VAH / Value Area High
- VAL / Value Area Low
- HVN / High Volume Nodes
- LVN / Low Volume Nodes
- Peak and Valley areas
- D-shape, P-shape, b-shape, double distribution, thin profile, etc.

Important:
- Only affect the total volume side.
- Keep the delta side exactly as it is now.
- Delta bars can stay scattered/separate because that is expected.
- Do not smooth delta.
- Do not modify the underlying volume profile calculation.
- Do not modify profile row data.
- Do not modify profile persistence, caching, MongoDB, or restore behavior.
- This is only canvas/rendering/styling.

Current issue:
The total volume profile currently looks like many separate horizontal bars with gaps. It is technically showing the data, but visually it does not form a readable auction profile shape.

Desired rendering:
1. Use the same volume-per-price-row data.
2. Build a continuous outer contour from row widths.
3. Connect adjacent row endpoints vertically.
4. Fill the inside of the total-volume profile shape as a filled polygon / filled area.
5. Keep row widths proportional to actual volume.
6. Optionally draw subtle row bars/edges on top of the fill for detail.
7. Optional light visual smoothing is allowed only for the total volume shape, but it must not distort the profile structure too much.
8. Highlight POC / highest volume row clearly.
9. Highlight Value Area body differently from outside-value-area rows if current code already knows VAH/VAL/POC.
10. If HVN/LVN or peak/valley detection already exists, preserve it; if not, do not implement new detection in this task unless it is already simple and local to rendering.

Color style:
Use a professional auction-profile palette:

- Outside value / low volume: light yellow / pale sand
- Value Area / main body: yellow-orange / orange
- POC / strongest row: stronger orange or amber accent
- Optional HVN line/accent: orange/gold
- Optional LVN line/accent: subtle muted yellow or thin line

Suggested colors:
- Low volume / outside value: #E8D98B
- Value area body: #D8A63A
- High volume body: #C96A2A
- POC accent: #F0A020
- Optional outline: rgba(240, 180, 60, 0.45)

Rendering idea:
- Draw filled total-volume polygon first.
- Then draw optional row-level bars/details on top.
- Then draw POC / VAH / VAL / HVN / LVN accents if those levels already exist.
- Keep delta side rendering unchanged and separate.

Expected result:
The total volume side should look like a filled, readable horizontal volume distribution instead of scattered bars.
The user should be able to visually identify the profile shape and high/low volume areas faster.
Delta should look exactly like before.

Files likely involved:
- chart canvas rendering logic
- volume profile drawing/render helpers
- any function that paints total volume bars

make this as option in settings for volume profile next to linear and sort 

Output after implementation:
1. Explain exactly what changed.
2. List files modified.
3. Confirm only total volume rendering changed.
4. Confirm delta rendering/calculation was untouched.
5. Confirm no storage/cache/MongoDB/profile-calculation logic changed.
6. Mention whether smoothing/fill/contour rendering was used.



































// {
//     "enabled": true,
//     "generatedAt": 1779637571003,
//     "streams": [
//         {
//             "key": "spot::btcusdt::1m",
//             "streamType": "kline",
//             "subscriberCount": 1,
//             "createdCount": 2,
//             "reusedCount": 0,
//             "closedCount": 1,
//             "eventCount": 3898,
//             "lastEventAt": 1779637560000,
//             "eventRatePerSecond": 0
//         },
//         {
//             "key": "spot::btcusdt",
//             "streamType": "aggTrade",
//             "subscriberCount": 1,
//             "createdCount": 2,
//             "reusedCount": 0,
//             "closedCount": 1,
//             "eventCount": 74067,
//             "lastEventAt": 1779637570143,
//             "eventRatePerSecond": 5.1249199231262015
//         },
//         {
//             "key": "futures::btcusdt",
//             "streamType": "aggTrade",
//             "subscriberCount": 1,
//             "createdCount": 2,
//             "reusedCount": 0,
//             "closedCount": 1,
//             "eventCount": 146455,
//             "lastEventAt": 1779637570231,
//             "eventRatePerSecond": 6.462035541195476
//         },
//         {
//             "key": "spot::btcusdt",
//             "streamType": "depth",
//             "subscriberCount": 1,
//             "createdCount": 1,
//             "reusedCount": 0,
//             "closedCount": 0,
//             "eventCount": 79163,
//             "lastEventAt": 1779637570979,
//             "eventRatePerSecond": 10.120240480961924
//         }
//     ],
//     "caches": {
//         "footprint": [
//             {
//                 "key": "BTCUSDT:spot:both",
//                 "kind": "footprint",
//                 "active": true,
//                 "hitCount": 0,
//                 "missCount": 1,
//                 "restoreRequestCount": 1,
//                 "restoreDedupeCount": 0,
//                 "liveTradeDedupeCount": 0,
//                 "cleanupCount": 137,
//                 "evictedCount": 0,
//                 "slicesRemoved": 0,
//                 "rowsRemoved": 0,
//                 "memoryBytesRemoved": 0,
//                 "lastCleanupAt": 1779637541810,
//                 "lastUpdatedAt": 1779637570870,
//                 "details": {
//                     "activeCacheKey": "BTCUSDT:spot:both",
//                     "baseSliceCount": 318,
//                     "baseBucketSize": 5,
//                     "baseTimeframe": "1m",
//                     "approximateRowCellCount": 2317,
//                     "approximateMemoryBytes": 104672,
//                     "coverageRange": {
//                         "startTime": 1779618420,
//                         "endTime": 1779637560
//                     },
//                     "loadedRanges": [
//                         {
//                             "startTime": 1779599640,
//                             "endTime": 1779629640
//                         }
//                     ],
//                     "inFlightRestoreCount": 0,
//                     "seenTradeKeyCount": 100000,
//                     "created": true,
//                     "subscriberCount": 1,
//                     "inactiveSince": null,
//                     "reused": true,
//                     "requestStartTime": 1779599640,
//                     "requestEndTime": 1779629640,
//                     "missingBaseSliceCount": 499,
//                     "retentionMinutes": 360,
//                     "inactiveGraceMs": 480000,
//                     "maxBaseSlices": 720,
//                     "maxRowCells": 100000,
//                     "slicesRemoved": 0,
//                     "rowsRemoved": 0,
//                     "approximateMemoryBytesBefore": 104416,
//                     "approximateMemoryBytesAfter": 104416,
//                     "lastCleanupTimestamp": 1779637541810
//                 }
//             }
//         ],
//         "volumeProfile": [
//             {
//                 "key": "BTCUSDT::spot::both::0.5",
//                 "kind": "volumeProfile",
//                 "active": true,
//                 "hitCount": 0,
//                 "missCount": 1,
//                 "restoreRequestCount": 1,
//                 "restoreDedupeCount": 0,
//                 "liveTradeDedupeCount": 0,
//                 "cleanupCount": 137,
//                 "evictedCount": 0,
//                 "slicesRemoved": 0,
//                 "rowsRemoved": 0,
//                 "memoryBytesRemoved": 0,
//                 "lastCleanupAt": 1779637541822,
//                 "lastUpdatedAt": 1779637570870,
//                 "details": {
//                     "activeCacheKey": "BTCUSDT::spot::both::0.5",
//                     "fineProfileSliceCount": 318,
//                     "fineRowCount": 17643,
//                     "baseBucketSize": 0.5,
//                     "baseTimeframeSeconds": 60,
//                     "tradeCount": 220399,
//                     "approximateMemoryBytes": 16856736,
//                     "coverageRange": {
//                         "startTime": 1779618420,
//                         "endTime": 1779637560
//                     },
//                     "loadedRanges": [
//                         {
//                             "startTime": 1779599640,
//                             "endTime": 1779629640
//                         }
//                     ],
//                     "inFlightRestoreCount": 0,
//                     "seenTradeKeyCount": 220399,
//                     "created": true,
//                     "subscriberCount": 1,
//                     "inactiveSince": null,
//                     "version": 441714,
//                     "reused": true,
//                     "requestStartTime": 1779599640,
//                     "requestEndTime": 1779629640,
//                     "missingBaseSliceCount": 500,
//                     "retentionMinutes": 360,
//                     "inactiveGraceMs": 480000,
//                     "maxBaseSlices": 720,
//                     "maxRows": 150000,
//                     "slicesRemoved": 0,
//                     "rowsRemoved": 0,
//                     "tradesRemoved": 0,
//                     "approximateMemoryBytesBefore": 16831560,
//                     "approximateMemoryBytesAfter": 16831560,
//                     "lastCleanupTimestamp": 1779637541822
//                 }
//             }
//         ],
//         "candle": [
//             {
//                 "key": "spot::BTCUSDT::1m",
//                 "kind": "candle",
//                 "active": true,
//                 "hitCount": 0,
//                 "missCount": 1,
//                 "restoreRequestCount": 2,
//                 "restoreDedupeCount": 1,
//                 "liveTradeDedupeCount": 0,
//                 "cleanupCount": 137,
//                 "evictedCount": 0,
//                 "slicesRemoved": 0,
//                 "rowsRemoved": 0,
//                 "memoryBytesRemoved": 0,
//                 "lastCleanupAt": 1779637541822,
//                 "lastUpdatedAt": 1779637570510,
//                 "details": {
//                     "activeCacheKey": "spot::BTCUSDT::1m",
//                     "candleCount": 361,
//                     "subscriberCount": 1,
//                     "contractType": "spot",
//                     "symbol": "BTCUSDT",
//                     "timeframe": "1m",
//                     "coverageRange": {
//                         "startTime": 1779615960,
//                         "endTime": 1779637560
//                     },
//                     "loadedRanges": [
//                         {
//                             "startTime": 1779615720,
//                             "endTime": 1779637320
//                         },
//                         {
//                             "startTime": 1779615720,
//                             "endTime": 1779637320
//                         },
//                         {
//                             "startTime": 1779615720,
//                             "endTime": 1779637320
//                         },
//                         {
//                             "startTime": 1779615720,
//                             "endTime": 1779637320
//                         },
//                         {
//                             "startTime": 1779615720,
//                             "endTime": 1779637320
//                         },
//                         {
//                             "startTime": 1779615720,
//                             "endTime": 1779637320
//                         },
//                         {
//                             "startTime": 1779615720,
//                             "endTime": 1779637320
//                         },
//                         {
//                             "startTime": 1779615720,
//                             "endTime": 1779637320
//                         },
//                         {
//                             "startTime": 1779615720,
//                             "endTime": 1779637320
//                         },
//                         {
//                             "startTime": 1779615780,
//                             "endTime": 1779637380
//                         },
//                         {
//                             "startTime": 1779615780,
//                             "endTime": 1779637380
//                         },
//                         {
//                             "startTime": 1779615780,
//                             "endTime": 1779637380
//                         },
//                         {
//                             "startTime": 1779615780,
//                             "endTime": 1779637380
//                         },
//                         {
//                             "startTime": 1779615780,
//                             "endTime": 1779637380
//                         },
//                         {
//                             "startTime": 1779615780,
//                             "endTime": 1779637380
//                         },
//                         {
//                             "startTime": 1779615780,
//                             "endTime": 1779637380
//                         },
//                         {
//                             "startTime": 1779615780,
//                             "endTime": 1779637380
//                         },
//                         {
//                             "startTime": 1779615780,
//                             "endTime": 1779637380
//                         },
//                         {
//                             "startTime": 1779615780,
//                             "endTime": 1779637380
//                         },
//                         {
//                             "startTime": 1779615780,
//                             "endTime": 1779637380
//                         },
//                         {
//                             "startTime": 1779615780,
//                             "endTime": 1779637380
//                         },
//                         {
//                             "startTime": 1779615780,
//                             "endTime": 1779637380
//                         },
//                         {
//                             "startTime": 1779615780,
//                             "endTime": 1779637380
//                         },
//                         {
//                             "startTime": 1779615780,
//                             "endTime": 1779637380
//                         },
//                         {
//                             "startTime": 1779615780,
//                             "endTime": 1779637380
//                         },
//                         {
//                             "startTime": 1779615780,
//                             "endTime": 1779637380
//                         },
//                         {
//                             "startTime": 1779615780,
//                             "endTime": 1779637380
//                         },
//                         {
//                             "startTime": 1779615780,
//                             "endTime": 1779637380
//                         },
//                         {
//                             "startTime": 1779615780,
//                             "endTime": 1779637380
//                         },
//                         {
//                             "startTime": 1779615780,
//                             "endTime": 1779637380
//                         },
//                         {
//                             "startTime": 1779615780,
//                             "endTime": 1779637380
//                         },
//                         {
//                             "startTime": 1779615780,
//                             "endTime": 1779637380
//                         },
//                         {
//                             "startTime": 1779615780,
//                             "endTime": 1779637380
//                         },
//                         {
//                             "startTime": 1779615780,
//                             "endTime": 1779637380
//                         },
//                         {
//                             "startTime": 1779615780,
//                             "endTime": 1779637380
//                         },
//                         {
//                             "startTime": 1779615780,
//                             "endTime": 1779637380
//                         },
//                         {
//                             "startTime": 1779615780,
//                             "endTime": 1779637380
//                         },
//                         {
//                             "startTime": 1779615780,
//                             "endTime": 1779637380
//                         },
//                         {
//                             "startTime": 1779615840,
//                             "endTime": 1779637440
//                         },
//                         {
//                             "startTime": 1779615840,
//                             "endTime": 1779637440
//                         },
//                         {
//                             "startTime": 1779615840,
//                             "endTime": 1779637440
//                         },
//                         {
//                             "startTime": 1779615840,
//                             "endTime": 1779637440
//                         },
//                         {
//                             "startTime": 1779615840,
//                             "endTime": 1779637440
//                         },
//                         {
//                             "startTime": 1779615840,
//                             "endTime": 1779637440
//                         },
//                         {
//                             "startTime": 1779615840,
//                             "endTime": 1779637440
//                         },
//                         {
//                             "startTime": 1779615840,
//                             "endTime": 1779637440
//                         },
//                         {
//                             "startTime": 1779615840,
//                             "endTime": 1779637440
//                         },
//                         {
//                             "startTime": 1779615840,
//                             "endTime": 1779637440
//                         },
//                         {
//                             "startTime": 1779615840,
//                             "endTime": 1779637440
//                         },
//                         {
//                             "startTime": 1779615840,
//                             "endTime": 1779637440
//                         },
//                         {
//                             "startTime": 1779615840,
//                             "endTime": 1779637440
//                         },
//                         {
//                             "startTime": 1779615840,
//                             "endTime": 1779637440
//                         },
//                         {
//                             "startTime": 1779615840,
//                             "endTime": 1779637440
//                         },
//                         {
//                             "startTime": 1779615840,
//                             "endTime": 1779637440
//                         },
//                         {
//                             "startTime": 1779615840,
//                             "endTime": 1779637440
//                         },
//                         {
//                             "startTime": 1779615840,
//                             "endTime": 1779637440
//                         },
//                         {
//                             "startTime": 1779615840,
//                             "endTime": 1779637440
//                         },
//                         {
//                             "startTime": 1779615840,
//                             "endTime": 1779637440
//                         },
//                         {
//                             "startTime": 1779615840,
//                             "endTime": 1779637440
//                         },
//                         {
//                             "startTime": 1779615840,
//                             "endTime": 1779637440
//                         },
//                         {
//                             "startTime": 1779615840,
//                             "endTime": 1779637440
//                         },
//                         {
//                             "startTime": 1779615840,
//                             "endTime": 1779637440
//                         },
//                         {
//                             "startTime": 1779615840,
//                             "endTime": 1779637440
//                         },
//                         {
//                             "startTime": 1779615840,
//                             "endTime": 1779637440
//                         },
//                         {
//                             "startTime": 1779615840,
//                             "endTime": 1779637440
//                         },
//                         {
//                             "startTime": 1779615840,
//                             "endTime": 1779637440
//                         },
//                         {
//                             "startTime": 1779615840,
//                             "endTime": 1779637440
//                         },
//                         {
//                             "startTime": 1779615900,
//                             "endTime": 1779637500
//                         },
//                         {
//                             "startTime": 1779615900,
//                             "endTime": 1779637500
//                         },
//                         {
//                             "startTime": 1779615900,
//                             "endTime": 1779637500
//                         },
//                         {
//                             "startTime": 1779615900,
//                             "endTime": 1779637500
//                         },
//                         {
//                             "startTime": 1779615900,
//                             "endTime": 1779637500
//                         },
//                         {
//                             "startTime": 1779615900,
//                             "endTime": 1779637500
//                         },
//                         {
//                             "startTime": 1779615900,
//                             "endTime": 1779637500
//                         },
//                         {
//                             "startTime": 1779615900,
//                             "endTime": 1779637500
//                         },
//                         {
//                             "startTime": 1779615900,
//                             "endTime": 1779637500
//                         },
//                         {
//                             "startTime": 1779615900,
//                             "endTime": 1779637500
//                         },
//                         {
//                             "startTime": 1779615900,
//                             "endTime": 1779637500
//                         },
//                         {
//                             "startTime": 1779615900,
//                             "endTime": 1779637500
//                         },
//                         {
//                             "startTime": 1779615900,
//                             "endTime": 1779637500
//                         },
//                         {
//                             "startTime": 1779615900,
//                             "endTime": 1779637500
//                         },
//                         {
//                             "startTime": 1779615900,
//                             "endTime": 1779637500
//                         },
//                         {
//                             "startTime": 1779615900,
//                             "endTime": 1779637500
//                         },
//                         {
//                             "startTime": 1779615900,
//                             "endTime": 1779637500
//                         },
//                         {
//                             "startTime": 1779615900,
//                             "endTime": 1779637500
//                         },
//                         {
//                             "startTime": 1779615900,
//                             "endTime": 1779637500
//                         },
//                         {
//                             "startTime": 1779615900,
//                             "endTime": 1779637500
//                         },
//                         {
//                             "startTime": 1779615900,
//                             "endTime": 1779637500
//                         },
//                         {
//                             "startTime": 1779615900,
//                             "endTime": 1779637500
//                         },
//                         {
//                             "startTime": 1779615900,
//                             "endTime": 1779637500
//                         },
//                         {
//                             "startTime": 1779615900,
//                             "endTime": 1779637500
//                         },
//                         {
//                             "startTime": 1779615900,
//                             "endTime": 1779637500
//                         },
//                         {
//                             "startTime": 1779615900,
//                             "endTime": 1779637500
//                         },
//                         {
//                             "startTime": 1779615900,
//                             "endTime": 1779637500
//                         },
//                         {
//                             "startTime": 1779615900,
//                             "endTime": 1779637500
//                         },
//                         {
//                             "startTime": 1779615960,
//                             "endTime": 1779637560
//                         },
//                         {
//                             "startTime": 1779615960,
//                             "endTime": 1779637560
//                         },
//                         {
//                             "startTime": 1779615960,
//                             "endTime": 1779637560
//                         },
//                         {
//                             "startTime": 1779615960,
//                             "endTime": 1779637560
//                         },
//                         {
//                             "startTime": 1779615960,
//                             "endTime": 1779637560
//                         }
//                     ],
//                     "historyRestored": true,
//                     "restoreInFlight": false,
//                     "approximateMemoryBytes": 34656,
//                     "created": true,
//                     "inactiveSince": null,
//                     "reused": true,
//                     "retentionMinutes": 360,
//                     "inactiveGraceMs": 480000,
//                     "maxCandles": 500,
//                     "slicesRemoved": 0,
//                     "rowsRemoved": 0,
//                     "approximateMemoryBytesBefore": 34656,
//                     "approximateMemoryBytesAfter": 34656,
//                     "lastCleanupTimestamp": 1779637541822
//                 }
//             }
//         ]
//     },
//     "storage": {
//         "recentRestoreCalls": [
//             {
//                 "kind": "storage",
//                 "key": "BTCUSDT:spot:both:1m:fineProfile",
//                 "timestamp": 1779637564593,
//                 "skippedRows": 2,
//                 "details": {
//                     "panelId": "left",
//                     "storageType": "fineProfileRows",
//                     "reason": "trade-advanced-1m",
//                     "slicesPersisted": 0,
//                     "rowsQueued": 0,
//                     "rowsSkippedDuplicate": 0,
//                     "rowsSkippedPartial": 0,
//                     "rowsSkippedOpen": 2
//                 }
//             },
//             {
//                 "kind": "storage",
//                 "key": "BTCUSDT:spot:both:1m:fineProfile",
//                 "timestamp": 1779637564594,
//                 "skippedRows": 2,
//                 "details": {
//                     "panelId": "left",
//                     "storageType": "fineProfileRows",
//                     "reason": "trade-advanced-1m",
//                     "slicesPersisted": 0,
//                     "rowsQueued": 0,
//                     "rowsSkippedDuplicate": 0,
//                     "rowsSkippedPartial": 0,
//                     "rowsSkippedOpen": 2
//                 }
//             }

//         ]
//     },
//     "totals": {
//         "activeStreams": 4,
//         "activeCaches": 3,
//         "streamEvents": 303583,
//         "cacheHits": 0,
//         "cacheMisses": 3,
//         "restoreRequests": 4,
//         "restoreDedupe": 1,
//         "liveTradeDedupe": 0,
//         "cacheCleanupRuns": 411,
//         "cacheKeysEvicted": 0,
//         "cacheSlicesRemoved": 0,
//         "cacheRowsRemoved": 0,
//         "cacheMemoryBytesRemoved": 0
//     }
// }