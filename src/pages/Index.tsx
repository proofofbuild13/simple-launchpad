import { Nav } from "@/components/site/Nav";
import { Hero } from "@/components/site/Hero";
import { HowItWorks } from "@/components/site/HowItWorks";
import { ProjectShowcase } from "@/components/site/ProjectShowcase";
import { Pillars } from "@/components/site/Pillars";
import { CTA } from "@/components/site/CTA";
import { Footer } from "@/components/site/Footer";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Nav />
      <main>
        <Hero />
        <HowItWorks />
        <ProjectShowcase />
        <Pillars />
        <CTA />
      </main>
      <Footer />
    </div>
  );
};

export default Index;
