import { SubmissionForm } from "@/components/forms/SubmissionForm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const FilmmakerSubmissions = () => {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-heading tracking-tight mb-4">
            Submit Your Project
          </h1>
          <p className="max-w-2xl mx-auto text-muted-gray font-sans text-lg">
            As a registered filmmaker, your submissions are fast-tracked. Fill out the form below to get your project in front of our curation team.
          </p>
        </div>
        <Card className="bg-muted-gray/10 border-muted-gray/20">
          <CardHeader>
            <CardTitle className="font-heading text-3xl uppercase text-accent-yellow text-center">
              Submission Form
            </CardTitle>
          </CardHeader>
          <CardContent>
            <SubmissionForm />
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default FilmmakerSubmissions;