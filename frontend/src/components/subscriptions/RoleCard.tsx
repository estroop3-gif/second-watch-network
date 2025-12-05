import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle } from "lucide-react";
import { ReactNode } from "react";

interface RoleCardProps {
  title: string;
  price?: ReactNode;
  description: string;
  features: string[];
  action?: ReactNode;
  badge?: ReactNode;
}

const RoleCard = ({ title, price, description, features, action, badge }: RoleCardProps) => {
  return (
    <Card className="bg-muted-gray/20 border-muted-gray flex flex-col h-full">
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-2xl font-bold text-white">{title}</CardTitle>
            {price && <div className="text-xl font-semibold text-accent-yellow mt-1">{price}</div>}
          </div>
          {badge}
        </div>
        <CardDescription className="text-muted-foreground pt-1">{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex-grow">
        <ul className="space-y-3">
          {features.map((feature, index) => (
            <li key={index} className="flex items-start">
              <CheckCircle className="h-5 w-5 text-accent-yellow mr-3 mt-0.5 flex-shrink-0" />
              <span className="text-bone-white">{feature}</span>
            </li>
          ))}
        </ul>
      </CardContent>
      {action && <CardFooter className="pt-4">{action}</CardFooter>}
    </Card>
  );
};

export default RoleCard;