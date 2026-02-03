import Navbar from '@/components/layout/Navbar';
import MarketingHero from '@/components/marketing/MarketingHero';
import DomainsSection from '@/components/marketing/DomainsSection';
import CoursesSection from '@/components/marketing/CoursesSection';
import CreatorCTA from '@/components/marketing/CreatorCTA';
import MarketingFooter from '@/components/marketing/MarketingFooter';

export default function Index() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1">
        <MarketingHero />
        <DomainsSection />
        <CoursesSection />
        <CreatorCTA />
      </main>
      <MarketingFooter />
    </div>
  );
}
