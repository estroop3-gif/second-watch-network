import HeroSection from "@/components/landing/HeroSection";
import LiveStreamSection from "@/components/landing/LiveStreamSection";
import TrendingNowSection from "@/components/landing/TrendingNowSection";
import OriginalsSection from "@/components/landing/OriginalsSection";
import GreenRoomSection from "@/components/landing/GreenRoomSection";
import SubmitContentSection from "@/components/landing/SubmitContentSection";
import BacklotSection from "@/components/landing/BacklotSection";
import TheOrderSection from "@/components/landing/TheOrderSection";
import PartnershipsSection from "@/components/landing/PartnershipsSection";
import OurStorySection from "@/components/landing/OurStorySection";
import SupportSection from "@/components/landing/SupportSection";
import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const LandingPage = () => {
  const location = useLocation();

  useEffect(() => {
    const hash = location.hash?.replace('#', '');
    if (!hash) return;
    const el = document.getElementById(hash);
    if (!el) return;
    const header = document.querySelector('header') as HTMLElement | null;
    const offset = header?.offsetHeight ?? 80;
    const top = el.getBoundingClientRect().top + window.scrollY - offset - 8;
    window.scrollTo({ top, behavior: 'smooth' });
    // Focus the first heading inside the section for a11y
    const heading = el.querySelector('h2, h3') as HTMLElement | null;
    if (heading) {
      heading.setAttribute('tabindex', '-1');
      // Allow scroll to finish a bit before focusing
      setTimeout(() => heading.focus(), 350);
    }
  }, [location.hash]);

  return (
    <>
      <HeroSection />
      <LiveStreamSection />
      <TrendingNowSection />
      <OriginalsSection />
      <GreenRoomSection />
      <SubmitContentSection />
      <BacklotSection />
      <TheOrderSection />
      <PartnershipsSection />
      <OurStorySection />
      <SupportSection />
    </>
  );
};

export default LandingPage;