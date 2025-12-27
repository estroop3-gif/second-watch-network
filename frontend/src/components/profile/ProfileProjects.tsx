import React from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Film } from 'lucide-react';
import { allContent, Content } from '@/data/content';
import { Credit } from '@/types';

interface ProfileProject extends Content {
  role: string;
}

interface ProfileProjectsProps {
  credits: Credit[];
}

const ProfileProjects = ({ credits }: ProfileProjectsProps) => {
  const filmmakerProjects: ProfileProject[] = React.useMemo(() => {
    if (!credits) return [];
    
    return credits
      .map(credit => {
        const contentItem = allContent.find(content => content.title === credit.productions.title);
        if (contentItem) {
          return {
            ...contentItem,
            role: credit.position,
          };
        }
        return null;
      })
      .filter((p): p is ProfileProject => p !== null);
  }, [credits]);

  if (filmmakerProjects.length === 0) {
    return (
      <Card className="bg-charcoal-black/50 border-muted-gray/20 text-center py-12">
        <CardContent className="flex flex-col items-center gap-4">
          <Film className="h-12 w-12 text-muted-gray" />
          <h3 className="text-xl font-heading text-bone-white">No Featured Projects</h3>
          <p className="text-muted-gray max-w-sm">
            This filmmaker has not yet been credited on any projects currently featured on Second Watch.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
      {filmmakerProjects.map(project => (
        <Card key={project.id} className="bg-charcoal-black/50 border-muted-gray/20 overflow-hidden group transition-all hover:border-accent-yellow/50">
          <Link to={project.linkTo} className="block">
            <div className="aspect-video overflow-hidden">
              <img 
                src={project.imageUrl} 
                alt={project.title} 
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
            </div>
          </Link>
          <CardContent className="p-4">
            <Link to={project.linkTo}>
              <h3 className="font-heading text-lg text-bone-white hover:text-accent-yellow transition-colors truncate">{project.title}</h3>
            </Link>
            <p className="text-sm text-accent-yellow font-semibold mb-3">{project.role}</p>
            <div className="flex flex-wrap gap-1">
              {project.tags.slice(0, 3).map(tag => (
                <Badge key={tag} variant="secondary" className="capitalize text-xs">{tag}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default ProfileProjects;