import { useNavigate } from 'react-router-dom';
import FilmmakerApplicationForm from '@/components/forms/FilmmakerApplicationForm';

const FilmmakerApplicationPage = () => {
  const navigate = useNavigate();

  return (
    <div className="bg-charcoal-black min-h-screen text-bone-white">
      <div className="container mx-auto px-4 py-12 sm:px-6 lg:px-8 max-w-4xl">
        <header className="text-center mb-12">
          <h1 className="text-4xl font-extrabold tracking-tight text-accent-yellow sm:text-5xl">
            Apply to Become a Filmmaker
          </h1>
          <p className="mt-4 max-w-2xl mx-auto text-lg text-muted-foreground">
            Help us get to know your work. This application helps maintain trust and quality on our platform.
          </p>
        </header>
        <FilmmakerApplicationForm onSuccess={() => navigate('/dashboard')} />
      </div>
    </div>
  );
};

export default FilmmakerApplicationPage;