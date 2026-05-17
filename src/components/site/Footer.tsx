export const Footer = () => (
  <footer className="border-t border-border">
    <div className="container py-12 flex flex-col md:flex-row gap-6 items-start md:items-center justify-between">
      <div className="flex items-center gap-2">
        <img src="/logo.png" alt="proof_of_Build" className="h-6 w-6 object-contain" />
        <span className="font-display text-lg">proof_of_Build</span>
        <span className="text-muted-foreground text-sm ml-2">— Build before you hire.</span>
      </div>
      <div className="flex gap-6 text-sm text-muted-foreground font-mono">
        <a href="#" className="hover:text-foreground">Twitter</a>
        <a href="#" className="hover:text-foreground">GitHub</a>
        <a href="#" className="hover:text-foreground">Privacy</a>
        <a href="#" className="hover:text-foreground">Terms</a>
      </div>
    </div>
  </footer>
);
