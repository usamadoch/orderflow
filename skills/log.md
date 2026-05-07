# Project Changelog

## [2026-05-07] - Initial Project Bootstrap

### Added
- **Project Setup**: Initialized Next.js 14 App Router project (`orderflowApp`) using `pnpm` with TypeScript, Tailwind CSS, and ESLint.
- **Dependencies**: Installed `lightweight-charts` and `zustand`.
- **Design System**: 
  - Overhauled `tailwind.config.ts` to strictly enforce `darkMode: 'class'`.
  - Added strict dark mode color palette (Background, Surface, Border, Text variations, Bull/Bear/Accent colors).
  - Updated `app/globals.css` with matching CSS variables.
  - Configured `app/layout.tsx` to load Google Fonts: `Inter` for UI and `JetBrains Mono` for numbers/data. Applied dark mode to the root HTML.
- **Project Structure**: Created directories for `components/chart`, `components/layout`, `components/ui`, `lib/feeds`, `lib/store`, `lib/utils`, and `types`.
- **Data Interfaces**: 
  - Added `types/candle.ts` (OHLCV interface).
  - Added `types/trade.ts` (Individual trade tick interface).
  - Added `lib/feeds/adapter.ts` (`FeedAdapter` contract for swappable data sources).
- **UI Scaffold**: Replaced the default Next.js `app/page.tsx` with the minimal OrderFlow layout.
  - Added a top toolbar with Pair Selector, Timeframe Selector, and Connection Status placeholders.
  - Added a collapsible sidebar for data settings (e.g., Tick Size).
  - Added the main chart container placeholder.

### Changed
- **UI Tweaks**: Made the header and sidebar skinnier in `app/page.tsx` for a denser, more professional trading tool layout.
  - Reduced header height from `h-14` to `h-10`.
  - Reduced sidebar width from `w-64` to `w-48`.
  - Scaled down padding, gaps, and font sizes across the header and sidebar.
