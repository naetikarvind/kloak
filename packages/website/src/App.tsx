import React from 'react';
import { Navbar } from './components/Navbar';
import { Hero } from './components/Hero';
import { StatsRibbon } from './components/StatsRibbon';
import { ArchitectureSection } from './components/ArchitectureSection';
import { GeneratorDemo } from './components/GeneratorDemo';
import { ComparisonSection } from './components/ComparisonSection';
import { DownloadsSection } from './components/DownloadsSection';
import { PrivacySummarySection } from './components/PrivacySummarySection';
import { FaqSection } from './components/FaqSection';
import { Footer } from './components/Footer';

export const App: React.FC = () => {
  return (
    <div style={{ position: 'relative', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Background Lighting Elements */}
      <div className="bg-ambient">
        <div className="bg-ambient-blob-1" />
        <div className="bg-ambient-blob-2" />
        <div className="bg-ambient-blob-3" />
        <div className="bg-ambient-grid" />
      </div>

      {/* Main Content */}
      <Navbar />

      <main style={{ flex: 1, zIndex: 1 }}>
        <Hero />
        <StatsRibbon />
        <section id="features">
          <ArchitectureSection />
        </section>
        <GeneratorDemo />
        <ComparisonSection />
        <DownloadsSection />
        <PrivacySummarySection />
        <FaqSection />
      </main>

      <Footer />
    </div>
  );
};

export default App;
