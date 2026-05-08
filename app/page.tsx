import { FeedProvider } from '../components/FeedProvider';
import { Header } from '../components/layout/Header';
import { Sidebar } from '../components/layout/Sidebar';
import { ChartCanvas } from '../components/chart/ChartCanvas';

export default function Home() {
  return (
    <FeedProvider>
      <div className="flex flex-col h-screen overflow-hidden text-main bg-background font-sans selection:bg-accent/30">
        <Header />

        <div className="flex flex-1 overflow-hidden">
          <Sidebar />

          <main className="flex-1 relative flex flex-col bg-[#080808]">
            <ChartCanvas />
          </main>
        </div>
      </div>
    </FeedProvider>
  );
}
