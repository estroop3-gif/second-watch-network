import FilmmakerOnboardingForm from '@/components/forms/FilmmakerOnboardingForm';

const FilmmakerOnboarding = () => {
  return (
    <div className="min-h-screen bg-charcoal-black text-white flex flex-col items-center p-4">
      <div className="w-full max-w-4xl mx-auto py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-6xl font-heading tracking-tighter mb-4 -rotate-1">
            Welcome to <span className="font-spray text-accent-yellow">Filmmaker Mode</span>
          </h1>
          <p className="text-muted-gray max-w-3xl mx-auto">
            Your profile helps the Second Watch community know what you do best. This takes just a few minutes and unlocks powerful tools for filmmakers.
          </p>
        </div>
        <FilmmakerOnboardingForm />
      </div>
    </div>
  );
};

export default FilmmakerOnboarding;