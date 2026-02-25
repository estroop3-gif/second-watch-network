/**
 * Public Portfolio Page — Standalone themed page at /p/:slug.
 * No SWN chrome, just portfolio content with a small footer.
 */
import { useParams } from 'react-router-dom';
import { usePublicPortfolio } from '@/hooks/useFilmmakerPro';
import { Badge } from '@/components/ui/badge';
import { MapPin, Mail, Globe, Calendar, DollarSign, Film } from 'lucide-react';

const THEME_STYLES: Record<string, { bg: string; text: string; muted: string; card: string; accent: string }> = {
  dark: { bg: 'bg-[#0a0a0a]', text: 'text-white', muted: 'text-gray-400', card: 'bg-[#1a1a1a] border-gray-800', accent: 'text-amber-400' },
  light: { bg: 'bg-white', text: 'text-gray-900', muted: 'text-gray-500', card: 'bg-gray-50 border-gray-200', accent: 'text-blue-600' },
  minimal: { bg: 'bg-[#fafafa]', text: 'text-gray-800', muted: 'text-gray-400', card: 'bg-white border-gray-100', accent: 'text-gray-800' },
  cinematic: { bg: 'bg-[#0d0d0d]', text: 'text-[#e8e0d6]', muted: 'text-[#8a7e72]', card: 'bg-[#1a1714] border-[#2a2520]', accent: 'text-[#d4a46a]' },
};

const PortfolioPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const { data, isLoading, error } = usePublicPortfolio(slug || '');

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="animate-pulse text-gray-400">Loading portfolio...</div>
      </div>
    );
  }

  if (error || !data?.config) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-2">Portfolio Not Found</h1>
          <p className="text-gray-400">This portfolio doesn't exist or hasn't been published yet.</p>
        </div>
      </div>
    );
  }

  const { config, filmmaker, credits, rate_cards, availability } = data;
  const theme = THEME_STYLES[config.theme] || THEME_STYLES.dark;
  const accentColor = config.accent_color || '#FF3C3C';
  const name = config.display_name || config.full_name || config.username;

  return (
    <div className={`min-h-screen ${theme.bg}`} style={{ '--portfolio-accent': accentColor } as any}>
      {/* Hero */}
      <header className="relative py-20 px-6 text-center">
        {config.hero_image_url && (
          <div className="absolute inset-0 overflow-hidden">
            <img src={config.hero_image_url} alt="" className="w-full h-full object-cover opacity-30" />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-current" style={{ color: theme.bg.replace('bg-', '') }} />
          </div>
        )}
        <div className="relative z-10 max-w-3xl mx-auto">
          {config.avatar_url && (
            <img src={config.avatar_url} alt={name} className="w-24 h-24 rounded-full mx-auto mb-6 border-2" style={{ borderColor: accentColor }} />
          )}
          <h1 className={`text-4xl md:text-5xl font-bold mb-3 ${theme.text}`}>{name}</h1>
          {config.custom_headline && (
            <p className="text-xl mb-4" style={{ color: accentColor }}>{config.custom_headline}</p>
          )}
          {filmmaker?.location && (
            <p className={`flex items-center justify-center gap-1 text-sm ${theme.muted}`}>
              <MapPin className="h-4 w-4" />{filmmaker.location}
            </p>
          )}
          {config.custom_intro && (
            <p className={`mt-6 max-w-xl mx-auto ${theme.muted} leading-relaxed`}>{config.custom_intro}</p>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 pb-20 space-y-16">
        {/* Credits */}
        {config.show_credits && credits?.length > 0 && (
          <section>
            <h2 className={`text-2xl font-bold mb-6 ${theme.text} flex items-center gap-2`}>
              <Film className="h-5 w-5" style={{ color: accentColor }} />Credits
            </h2>
            <div className="grid gap-3">
              {credits.map((credit: any) => (
                <div key={credit.id} className={`p-4 rounded-lg border ${theme.card}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className={`font-medium ${theme.text}`}>{credit.title || credit.project_title}</p>
                      <p className={`text-sm ${theme.muted}`}>{credit.role}{credit.year ? ` (${credit.year})` : ''}</p>
                    </div>
                    {credit.category && <Badge variant="outline">{credit.category}</Badge>}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Rate Card */}
        {config.show_rate_card && rate_cards?.length > 0 && (
          <section>
            <h2 className={`text-2xl font-bold mb-6 ${theme.text} flex items-center gap-2`}>
              <DollarSign className="h-5 w-5" style={{ color: accentColor }} />Rates
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {rate_cards.map((card: any) => (
                <div key={card.id} className={`p-4 rounded-lg border ${theme.card}`}>
                  <p className={`font-medium mb-2 ${theme.text}`}>{card.role_name}</p>
                  <div className="flex flex-wrap gap-3 text-sm">
                    {card.day_rate_cents && <span className={theme.muted}>Day: <strong className={theme.text}>${(card.day_rate_cents / 100).toFixed(0)}</strong></span>}
                    {card.half_day_rate_cents && <span className={theme.muted}>Half: <strong className={theme.text}>${(card.half_day_rate_cents / 100).toFixed(0)}</strong></span>}
                    {card.weekly_rate_cents && <span className={theme.muted}>Week: <strong className={theme.text}>${(card.weekly_rate_cents / 100).toFixed(0)}</strong></span>}
                    {card.hourly_rate_cents && <span className={theme.muted}>Hour: <strong className={theme.text}>${(card.hourly_rate_cents / 100).toFixed(0)}</strong></span>}
                  </div>
                  {card.notes && <p className={`text-xs mt-2 ${theme.muted}`}>{card.notes}</p>}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Availability */}
        {config.show_availability && availability?.length > 0 && (
          <section>
            <h2 className={`text-2xl font-bold mb-6 ${theme.text} flex items-center gap-2`}>
              <Calendar className="h-5 w-5" style={{ color: accentColor }} />Availability
            </h2>
            <div className="grid gap-2">
              {availability.map((entry: any) => (
                <div key={entry.id} className={`p-3 rounded-lg border flex items-center gap-3 ${theme.card}`}>
                  <div className={`w-3 h-3 rounded-full ${
                    entry.status === 'available' ? 'bg-green-500' :
                    entry.status === 'booked' ? 'bg-red-500' :
                    entry.status === 'tentative' ? 'bg-yellow-500' : 'bg-gray-500'
                  }`} />
                  <div className="flex-1">
                    <p className={`text-sm ${theme.text}`}>{entry.title || entry.status}</p>
                    <p className={`text-xs ${theme.muted}`}>
                      {new Date(entry.start_date).toLocaleDateString()} — {new Date(entry.end_date).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Contact */}
        {config.show_contact_form && config.email && (
          <section className="text-center">
            <h2 className={`text-2xl font-bold mb-4 ${theme.text}`}>Get in Touch</h2>
            <a
              href={`mailto:${config.email}`}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg font-medium text-white transition-colors"
              style={{ backgroundColor: accentColor }}
            >
              <Mail className="h-4 w-4" />Contact Me
            </a>
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className={`text-center py-6 border-t ${theme.card.split(' ')[1]} ${theme.muted}`}>
        <p className="text-xs">
          Built on <a href="/" className="underline hover:text-white">Second Watch Network</a>
        </p>
      </footer>
    </div>
  );
};

export default PortfolioPage;
