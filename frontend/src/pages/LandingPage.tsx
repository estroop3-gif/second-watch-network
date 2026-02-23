import HeroSection from "@/components/landing/HeroSection";
import CreateAccountSection from "@/components/landing/CreateAccountSection";
import BacklotSection from "@/components/landing/BacklotSection";
import CommunityFeaturesSection from "@/components/landing/CommunityFeaturesSection";
import SubmitContentSection from "@/components/landing/SubmitContentSection";
import PartnershipsSection from "@/components/landing/PartnershipsSection";
import GreenRoomSection from "@/components/landing/GreenRoomSection";
import SupportSection from "@/components/landing/SupportSection";
import OriginalsSection from "@/components/landing/OriginalsSection";
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
      <CreateAccountSection />
      <BacklotSection />
      <CommunityFeaturesSection />
      <SubmitContentSection />
      <PartnershipsSection />
      <GreenRoomSection />
      <SupportSection />
      <OriginalsSection />
    </>
  );
};

export default LandingPage;