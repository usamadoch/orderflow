Improve history restore UX and loading behavior.

Issue:
History restore actually works, but when there is a lot of stored data it can take a while before candles/footprint/profile appear. During that time there is no clear UI indication and sometimes no obvious terminal/network feedback, so it looks like history is not loading.

Goal:
Make history restore visible and smoother.

Task 1: Add restore/loading status UI
Show a small loading/status indicator while history is being restored.

Preferred placement:

* top/header area or top-right chart area
* small and clean, not a full-screen blocking loader

Show useful status like:

* Restoring candles...
* Restoring footprint...
* Restoring Volume Profile...
* Restored X candles / X footprint rows / X profile rows
* Live feed connected

Do not block live rendering if live data is already available.

Task 2: Add/verify progressive restore
Check how history restore currently works.

If it already restores progressively, expose that progress in UI.

If it currently waits for too much data before rendering:

* render candles first
* then hydrate footprint/profile as they arrive
* avoid waiting for all history before showing chart

Task 3: Pagination / lazy loading audit + small implementation if safe
Check whether restore APIs already support pagination or range-based loading.

Goal behavior:

* Load recent history first.
* Older data loads only when needed, such as when user scrolls/pans left.
* Do not fetch huge history all at once if not required.
* Avoid duplicate restore requests for already-loaded ranges.

If full lazy loading is too big, implement only:

* recent-first restore
* clear loading indicator
* leave full infinite backfill as a follow-up task

Do not change:

* collector script
* MongoDB schema
* market data calculations
* footprint/profile calculations
* heatmap/liquidity
* chart drawing tools

Validation:

* Start website with several hours of DB history.
* Refresh page.
* Confirm loading status appears immediately.
* Confirm recent candles show first.
* Confirm footprint/profile restore status updates.
* Confirm live feed can continue while history restores.
* Confirm no duplicate huge restore loops.
* Confirm no storage/write behavior changes.

Output:

1. Explain current restore behavior found.
2. Explain what loading UI was added.
3. Explain whether pagination/lazy loading exists or was added.
4. Confirm chart renders recent data first.
5. List files changed.
