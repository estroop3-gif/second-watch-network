/**
 * Order Landing Page
 * Introduction to The Second Watch Order
 */
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Shield,
  Users,
  Briefcase,
  MapPin,
  CheckCircle2,
  Star,
  Handshake,
  Crown,
} from 'lucide-react';

const BENEFITS = [
  {
    icon: Users,
    title: 'Professional Network',
    description: 'Connect with vetted Christian filmmakers and crew across the industry.',
  },
  {
    icon: Briefcase,
    title: 'Exclusive Jobs',
    description: 'Access job opportunities reserved for Order members first.',
  },
  {
    icon: MapPin,
    title: 'Local Lodges',
    description: 'Join city-based lodges for in-person networking and collaboration.',
  },
  {
    icon: Handshake,
    title: 'Booking System',
    description: 'Get hired directly through our professional booking request system.',
  },
  {
    icon: Star,
    title: 'Premium Support',
    description: 'Priority support and dedicated resources for Order members.',
  },
  {
    icon: Crown,
    title: 'Industry Recognition',
    description: 'Build your reputation within a trusted professional community.',
  },
];

export default function OrderLanding() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { hasRole } = usePermissions();

  const isOrderMember = hasRole('order_member');

  return (
    <div className="container mx-auto py-8 px-4">
      {/* Hero Section */}
      <div className="text-center mb-12">
        <div className="flex justify-center mb-6">
          <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center">
            <Shield className="h-12 w-12 text-primary" />
          </div>
        </div>
        <h1 className="text-4xl font-bold mb-4">The Second Watch Order</h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-6">
          A professional, God-centered guild of film industry craftspeople committed to excellence,
          integrity, and serving the Kingdom through their work.
        </p>

        {!user ? (
          <div className="flex justify-center gap-4">
            <Button size="lg" onClick={() => navigate('/login?redirect=/order')}>
              Sign In to Apply
            </Button>
            <Button size="lg" variant="outline" onClick={() => navigate('/signup')}>
              Create Account
            </Button>
          </div>
        ) : isOrderMember ? (
          <div className="flex justify-center gap-4">
            <Button size="lg" onClick={() => navigate('/order/dashboard')}>
              <Shield className="h-4 w-4 mr-2" />
              Go to Dashboard
            </Button>
            <Button size="lg" variant="outline" onClick={() => navigate('/order/directory')}>
              <Users className="h-4 w-4 mr-2" />
              Member Directory
            </Button>
          </div>
        ) : (
          <Button size="lg" onClick={() => navigate('/order/apply')}>
            Apply for Membership
          </Button>
        )}
      </div>

      {/* Benefits Grid */}
      <div className="mb-12">
        <h2 className="text-2xl font-bold text-center mb-8">Membership Benefits</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {BENEFITS.map((benefit, index) => (
            <Card key={index}>
              <CardHeader>
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <benefit.icon className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-lg">{benefit.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">{benefit.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Membership Requirements */}
      <Card className="mb-12">
        <CardHeader>
          <CardTitle>Membership Requirements</CardTitle>
          <CardDescription>
            The Order maintains high standards to ensure quality and trust within the community.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            <li className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
              <span>Professional experience in film, TV, or media production</span>
            </li>
            <li className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
              <span>Commitment to excellence and professional integrity</span>
            </li>
            <li className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
              <span>Alignment with Second Watch Network's faith-driven mission</span>
            </li>
            <li className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
              <span>Portfolio or work samples demonstrating your craft</span>
            </li>
          </ul>
        </CardContent>
      </Card>

      {/* Dues Info */}
      <Card className="mb-12">
        <CardHeader>
          <CardTitle>Membership Dues</CardTitle>
          <CardDescription>
            Dues support the Order's operations, events, and member services.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="text-center p-6 bg-muted rounded-lg">
              <p className="text-3xl font-bold">$25</p>
              <p className="text-muted-foreground">per month</p>
            </div>
            <div className="flex-1">
              <p className="mb-2">Your dues help fund:</p>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>- Lodge events and meetups</li>
                <li>- Job board maintenance</li>
                <li>- Member support and resources</li>
                <li>- Community development initiatives</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* How It Works */}
      <div className="mb-12">
        <h2 className="text-2xl font-bold text-center mb-8">How It Works</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="text-center">
            <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center mx-auto mb-4 text-xl font-bold">
              1
            </div>
            <h3 className="font-semibold mb-2">Apply</h3>
            <p className="text-sm text-muted-foreground">
              Submit your application with portfolio and statement.
            </p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center mx-auto mb-4 text-xl font-bold">
              2
            </div>
            <h3 className="font-semibold mb-2">Review</h3>
            <p className="text-sm text-muted-foreground">
              Our team reviews your application and credentials.
            </p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center mx-auto mb-4 text-xl font-bold">
              3
            </div>
            <h3 className="font-semibold mb-2">Join</h3>
            <p className="text-sm text-muted-foreground">
              Set up your dues and complete your member profile.
            </p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center mx-auto mb-4 text-xl font-bold">
              4
            </div>
            <h3 className="font-semibold mb-2">Connect</h3>
            <p className="text-sm text-muted-foreground">
              Access jobs, directory, and join a local lodge.
            </p>
          </div>
        </div>
      </div>

      {/* CTA */}
      {!isOrderMember && (
        <div className="text-center">
          <Card className="inline-block">
            <CardContent className="pt-6">
              <h3 className="text-xl font-semibold mb-2">Ready to Join?</h3>
              <p className="text-muted-foreground mb-4">
                Take the first step toward joining our professional community.
              </p>
              {user ? (
                <Button size="lg" onClick={() => navigate('/order/apply')}>
                  Apply Now
                </Button>
              ) : (
                <Button size="lg" onClick={() => navigate('/login?redirect=/order/apply')}>
                  Sign In to Apply
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Quick Links for Members */}
      {isOrderMember && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Button variant="outline" className="h-auto py-4" onClick={() => navigate('/order/dashboard')}>
            <div className="text-center">
              <Shield className="h-6 w-6 mx-auto mb-2" />
              <span>Dashboard</span>
            </div>
          </Button>
          <Button variant="outline" className="h-auto py-4" onClick={() => navigate('/order/directory')}>
            <div className="text-center">
              <Users className="h-6 w-6 mx-auto mb-2" />
              <span>Directory</span>
            </div>
          </Button>
          <Button variant="outline" className="h-auto py-4" onClick={() => navigate('/order/jobs')}>
            <div className="text-center">
              <Briefcase className="h-6 w-6 mx-auto mb-2" />
              <span>Jobs</span>
            </div>
          </Button>
          <Button variant="outline" className="h-auto py-4" onClick={() => navigate('/order/lodges')}>
            <div className="text-center">
              <MapPin className="h-6 w-6 mx-auto mb-2" />
              <span>Lodges</span>
            </div>
          </Button>
        </div>
      )}
    </div>
  );
}
