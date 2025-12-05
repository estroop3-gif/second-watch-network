import { Rocket } from 'lucide-react';

const ComingSoonPage = () => {
  return (
    <div className="bg-charcoal-black text-white min-h-screen flex flex-col items-center justify-center text-center p-4">
      <Rocket className="h-24 w-24 text-accent-yellow mb-8" />
      <h1 className="text-5xl font-heading mb-4">Coming Soon!</h1>
      <p className="text-lg text-muted-gray max-w-2xl">
        We're working hard to bring you something amazing. Stay tuned!
      </p>
    </div>
  );
};

export default ComingSoonPage;