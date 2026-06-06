import { Helmet } from "react-helmet-async";
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
      <Helmet>
        <title>proof_of_Build — Build before you hire</title>
        <meta name="description" content="Execution-based startup talent platform. Founders post real challenges, builders ship working prototypes, escrow and contracts handled." />
        <link rel="canonical" href="https://proofbuild.in/" />
        <meta property="og:title" content="proof_of_Build — Build before you hire" />
        <meta property="og:description" content="Execution-based startup talent platform. Founders post real challenges, builders ship working prototypes, escrow and contracts handled." />
        <meta property="og:url" content="https://proofbuild.in/" />
      </Helmet>
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
