import { Helmet } from "react-helmet-async";
import { Nav } from "@/components/site/Nav";
import { Hero } from "@/components/site/Hero";
import { HowItWorks } from "@/components/site/HowItWorks";
import { MetricsBand } from "@/components/site/MetricsBand";
import { ProjectShowcase } from "@/components/site/ProjectShowcase";
import { Pillars } from "@/components/site/Pillars";
import { AudienceSplit } from "@/components/site/AudienceSplit";
import { BuildersSection } from "@/components/site/BuildersSection";
import { Pricing } from "@/components/site/Pricing";
import { FAQ } from "@/components/site/FAQ";
import { CTA } from "@/components/site/CTA";
import { Footer } from "@/components/site/Footer";

const orgJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "proof_of_Build",
  url: "https://proofbuild.in/",
  logo: "https://proofbuild.in/logo.png",
  description:
    "Execution-based hiring platform. Founders post real challenges, builders ship prototypes, escrow and contracts handled.",
  sameAs: ["https://twitter.com/", "https://github.com/"],
};

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>proof_of_Build — Build before you hire</title>
        <meta
          name="description"
          content="Execution-based hiring. Founders post real challenges, builders ship prototypes, escrow and contracts handled end-to-end."
        />
        <meta
          name="keywords"
          content="hire developers, freelance, escrow, prototype hiring, builder marketplace, startup hiring"
        />
        <link rel="canonical" href="https://proofbuild.in/" />
        <meta property="og:title" content="proof_of_Build — Build before you hire" />
        <meta
          property="og:description"
          content="Execution-based hiring. Founders post real challenges, builders ship prototypes, escrow and contracts handled end-to-end."
        />
        <meta property="og:url" content="https://proofbuild.in/" />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <script type="application/ld+json">{JSON.stringify(orgJsonLd)}</script>
      </Helmet>
      <Nav />
      <main>
        <Hero />
        <HowItWorks />
        <MetricsBand />
        <ProjectShowcase />
        <BuildersSection />
        <Pillars />
        <AudienceSplit />
        <Pricing />
        <FAQ />
        <CTA />
      </main>
      <Footer />
    </div>
  );
};

export default Index;
