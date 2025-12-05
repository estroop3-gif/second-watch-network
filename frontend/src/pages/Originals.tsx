import React from 'react';
import ShowPlaceholder from '@/components/originals/ShowPlaceholder';

interface OriginalShow {
  title: string;
  tagline: React.ReactNode;
  imageUrl: string;
  linkTo?: string;
}

const originals: OriginalShow[] = [
  {
    title: 'Serve ItUp',
    tagline: 'Pros. Rookies. One house. Zero excuses. Pickleball gets personal.',
    imageUrl: '/images/serve-it-up.jpg',
    linkTo: '/serve-it-up',
  },
  {
    title: 'Coastal Torque',
    tagline: 'Street-built machines. Gulf Coast heat. Sarasota’s underground car culture, uncaged.',
    imageUrl: '/images/coastal-torque.jpg',
    linkTo: '/coastal-torque',
  },
  {
    title: 'Serving for Greece',
    tagline: 'One mission. One nation. Two unlikely athletes representing Greece on the world pickleball stage.',
    imageUrl: '/images/serving-for-greece.jpg',
    linkTo: '/serving-for-greece',
  },
  {
    title: 'Failure to Thrive',
    tagline: 'A brother’s illness. A family’s story. A documentary about love, loss, and learning to breathe through the unknown.',
    imageUrl: '/images/failure-to-thrive.jpg',
    linkTo: '/failure-to-thrive',
  },
  {
    title: 'The Unseen',
    tagline: (
      <>
        They came to be seen.
        <br />
        But healing requires exposure.
        <br />
        And grace doesn’t come without a cost.
      </>
    ),
    imageUrl: '/images/the-unseen.png',
  },
  {
    title: "Cue'd Up",
    tagline: "Hustlers. Underdogs. One shot at the table. Cue’d Up is where the game gets personal.",
    imageUrl: '/images/cued-up.png',
    linkTo: '/cued-up',
  },
];

const Originals = () => {
  return (
    <div className="container mx-auto px-4 text-center py-12">
      <h1 className="text-4xl md:text-6xl font-heading tracking-tighter mb-4">
        <span className="font-spray">Second Watch</span> Originals
      </h1>
      <p className="max-w-2xl mx-auto text-muted-gray mb-16 font-sans normal-case text-lg">
        Raw. Independent. Creator-made. These are the stories that define Second Watch Network.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-16">
        {originals.map((show) => (
          <ShowPlaceholder key={show.title} {...show} />
        ))}
      </div>
    </div>
  );
};

export default Originals;