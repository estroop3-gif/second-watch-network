import React from 'react';

const FailureToThrive = () => {
  return (
    <div className="container mx-auto px-4 py-12">
      <div className="text-center mb-16">
        <h1 className="text-5xl md:text-7xl font-heading tracking-tighter mb-4 -rotate-1">
          Failure to Thrive
        </h1>
        <p className="max-w-2xl mx-auto text-muted-gray font-sans normal-case text-xl">
          A brother’s illness. A family’s story. A documentary about love, loss, and learning to breathe through the unknown.
        </p>
      </div>

      <div className="mb-20 p-4 bg-bone-white border-4 border-charcoal-black shadow-lg transform -rotate-2">
        <div className="flex items-center justify-center h-64 md:h-96 bg-charcoal-black border-2 border-muted-gray">
          <span className="font-spray text-6xl md:text-9xl text-accent-yellow transform rotate-[-5deg]">
            COMING SOON
          </span>
        </div>
      </div>
      
      <hr className="border-dashed border-muted-gray my-20" />

      <div className="max-w-2xl mx-auto text-center">
        <h2 className="text-4xl font-heading mb-6 -rotate-2">What’s Coming</h2>
        <p className="text-muted-gray font-sans normal-case leading-relaxed text-lg">
          Raw interviews, personal archives, and an unfiltered look at a family fighting through cystic fibrosis.
        </p>
      </div>
    </div>
  );
};

export default FailureToThrive;