import React from 'react';

const CuedUp = () => {
  return (
    <div className="container mx-auto px-4 py-12">
      <div className="text-center mb-16">
        <h1 className="text-5xl md:text-7xl font-heading tracking-tighter mb-4 -rotate-1">
          Cue'd Up
        </h1>
        <p className="max-w-2xl mx-auto text-muted-gray font-sans normal-case text-xl">
          Hustlers. Underdogs. One shot at the table. Cue’d Up is where the game gets personal.
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
          Pool hall pressure, regional rivalries, and real players chasing respect in this docu-competition series.
        </p>
      </div>
    </div>
  );
};

export default CuedUp;