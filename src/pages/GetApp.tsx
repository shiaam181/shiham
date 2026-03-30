import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Smartphone, ArrowRight, ArrowLeft, Download, Shield, Zap, Globe } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { ScrollReveal } from '@/components/landing/ScrollReveal';
import { GoldenParticles } from '@/components/landing/GoldenParticles';

export default function GetApp() {
  const navigate = useNavigate();
  const [storeLinks, setStoreLinks] = useState<{ play_store?: string; app_store?: string }>({});

  useEffect(() => {
    supabase.rpc('get_public_auth_settings' as never).then(({ data }) => {
      const rows = data as Array<{ key: string; value: Record<string, unknown> }> | null;
      const links = rows?.find((r) => r.key === 'app_store_links')?.value as { play_store?: string; app_store?: string } ?? {};
      setStoreLinks(links);
    });
  }, []);

  const features = [
    { icon: Zap, title: 'Lightning Fast', description: 'Native performance with instant load times and smooth animations.' },
    { icon: Shield, title: 'Secure & Private', description: 'Face verification, GPS tracking, and encrypted data — all on your device.' },
    { icon: Globe, title: 'Works Offline', description: 'Mark attendance, view payslips, and access key features even without internet.' },
    { icon: Download, title: 'Auto Updates', description: 'Always get the latest features without manually updating from the store.' },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-card/95 backdrop-blur-xl border-b border-border/50">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-4 sm:px-6 h-14">
          <Link to="/" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>
          <Button size="sm" onClick={() => navigate('/auth')}>
            Get Started
          </Button>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <GoldenParticles />
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 pt-20 pb-16 text-center">
          <ScrollReveal>
            <div className="w-20 h-20 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-8">
              <Smartphone className="w-10 h-10 text-primary" />
            </div>
          </ScrollReveal>
          <ScrollReveal delay={100}>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight mb-4">
              Get the App
            </h1>
          </ScrollReveal>
          <ScrollReveal delay={200}>
            <p className="text-lg sm:text-xl text-muted-foreground max-w-lg mx-auto mb-10 leading-relaxed">
              Download our app for the best experience. Available on Android and iOS.
            </p>
          </ScrollReveal>

          {/* Store Buttons */}
          <ScrollReveal delay={300}>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-10">
              {storeLinks.play_store && (
                <a href={storeLinks.play_store} target="_blank" rel="noopener noreferrer">
                  <div className="flex items-center gap-3 bg-foreground/5 hover:bg-foreground/10 border border-border rounded-xl px-6 py-3.5 transition-all">
                    <svg viewBox="0 0 24 24" className="w-8 h-8 text-foreground" fill="currentColor"><path d="M3.609 1.814L13.792 12 3.61 22.186a.996.996 0 01-.61-.92V2.734a1 1 0 01.609-.92zm10.89 10.893l2.302 2.302-10.937 6.333 8.635-8.635zm3.199-3.199l2.807 1.626a1 1 0 010 1.732l-2.807 1.626L15.206 12l2.492-2.492zM5.864 2.658L16.8 8.99l-2.302 2.302-8.634-8.634z"/></svg>
                    <div className="text-left">
                      <p className="text-muted-foreground text-[10px] uppercase tracking-wider">Get it on</p>
                      <p className="text-foreground font-semibold text-lg leading-tight">Google Play</p>
                    </div>
                  </div>
                </a>
              )}
              {storeLinks.app_store && (
                <a href={storeLinks.app_store} target="_blank" rel="noopener noreferrer">
                  <div className="flex items-center gap-3 bg-foreground/5 hover:bg-foreground/10 border border-border rounded-xl px-6 py-3.5 transition-all">
                    <svg viewBox="0 0 24 24" className="w-8 h-8 text-foreground" fill="currentColor"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
                    <div className="text-left">
                      <p className="text-muted-foreground text-[10px] uppercase tracking-wider">Download on the</p>
                      <p className="text-foreground font-semibold text-lg leading-tight">App Store</p>
                    </div>
                  </div>
                </a>
              )}
              {!storeLinks.play_store && !storeLinks.app_store && (
                <div className="text-muted-foreground text-sm bg-muted/50 rounded-xl px-6 py-4 border border-border">
                  <Smartphone className="w-6 h-6 mx-auto mb-2 text-primary" />
                  App store links will be available soon. You can still use the web version!
                </div>
              )}
            </div>
          </ScrollReveal>

          <ScrollReveal delay={400}>
            <div className="flex flex-col items-center gap-2">
              <span className="text-muted-foreground text-sm">or</span>
              <Button variant="ghost" onClick={() => navigate('/auth')} className="text-muted-foreground hover:text-foreground">
                Continue on Web <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* Why Download */}
      <section className="py-20 bg-muted/30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <ScrollReveal>
            <div className="text-center mb-14">
              <h2 className="text-3xl sm:text-4xl font-bold mb-3">Why Download the App?</h2>
              <p className="text-muted-foreground text-lg">A better experience, right in your pocket.</p>
            </div>
          </ScrollReveal>
          <div className="grid sm:grid-cols-2 gap-6">
            {features.map((f, i) => (
              <ScrollReveal key={f.title} delay={i * 100}>
                <div className="bg-card rounded-2xl border border-border/50 p-6 hover:shadow-lg hover:border-primary/20 transition-all duration-300 group">
                  <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/15 transition-colors">
                    <f.icon className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="font-semibold text-lg mb-2">{f.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{f.description}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          <span>© {new Date().getFullYear()} Zentrek. All rights reserved.</span>
          <div className="flex gap-4">
            <Link to="/privacy-policy" className="hover:text-foreground transition-colors">Privacy</Link>
            <Link to="/terms" className="hover:text-foreground transition-colors">Terms</Link>
            <Link to="/contact-support" className="hover:text-foreground transition-colors">Support</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
