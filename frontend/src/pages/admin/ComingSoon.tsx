import React from 'react';

const AdminComingSoon = () => {
  return (
    <div>
      <h1 className="text-4xl md:text-6xl font-heading tracking-tighter mb-4 -rotate-1">
        Coming <span className="font-spray text-accent-yellow">Soon</span>
      </h1>
      <p className="text-muted-gray font-sans normal-case text-lg">
        This section is under construction. We're working hard to build out more tools for the rebellion.
      </p>
      <div className="mt-12 p-8 border-4 border-dashed border-accent-yellow/50 transform -rotate-2">
        <span className="font-spray text-5xl md:text-7xl text-muted-gray/50 transform rotate-[-5deg]">
          Pardon Our Dust
        </span>
      </div>
    </div>
  );
};

export default AdminComingSoon;