import { Link } from "react-router-dom";
import { Mail, Instagram, Youtube } from "lucide-react";

const Contact = () => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-charcoal-black p-4">
      <div className="w-full max-w-lg text-center space-y-8 border-2 border-muted-gray p-8 bg-charcoal-black/50">
        <h1 className="text-4xl font-heading text-accent-yellow uppercase">
          Contact Us
        </h1>
        <p className="text-bone-white font-sans text-lg">
          Have a question, need support, or want to get in touch? We'd love to hear from you.
        </p>

        <div className="space-y-6 text-left">
          {/* Email */}
          <div className="flex items-start gap-4 p-4 bg-muted-gray/10 border border-muted-gray/30 rounded-lg">
            <Mail className="h-6 w-6 text-accent-yellow mt-0.5 shrink-0" />
            <div>
              <p className="text-bone-white font-medium">Email</p>
              <a
                href="mailto:parker.stroop@theswn.com"
                className="text-accent-yellow hover:text-bone-white transition-colors"
              >
                parker.stroop@theswn.com
              </a>
            </div>
          </div>

          {/* Social */}
          <div className="flex items-center justify-center gap-6 pt-2">
            <a
              href="https://www.instagram.com/secondwatchnetwork"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-muted-gray hover:text-accent-yellow transition-colors"
            >
              <Instagram className="h-5 w-5" />
              <span className="text-sm">Instagram</span>
            </a>
            <a
              href="https://www.youtube.com/@SecondWatchNetwork"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-muted-gray hover:text-accent-yellow transition-colors"
            >
              <Youtube className="h-5 w-5" />
              <span className="text-sm">YouTube</span>
            </a>
          </div>
        </div>

        <div className="pt-4">
          <Link
            to="/"
            className="text-sm text-muted-gray hover:text-accent-yellow underline"
          >
            Back to home
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Contact;
