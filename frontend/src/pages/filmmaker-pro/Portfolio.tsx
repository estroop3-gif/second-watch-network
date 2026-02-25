/**
 * Portfolio Editor — Configure and preview the public portfolio site.
 */
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Globe, Eye, EyeOff, ExternalLink, Check, X } from 'lucide-react';
import { usePortfolioConfig, useUpdatePortfolio, useCheckSlug } from '@/hooks/useFilmmakerPro';
import { useEnrichedProfile } from '@/context/EnrichedProfileContext';
import ProUpgradePrompt from '@/components/filmmaker-pro/ProUpgradePrompt';
import { useToast } from '@/hooks/use-toast';

const THEMES = [
  { value: 'dark', label: 'Dark', desc: 'Dark background, high contrast' },
  { value: 'light', label: 'Light', desc: 'Clean white background' },
  { value: 'minimal', label: 'Minimal', desc: 'Simple, content-focused' },
  { value: 'cinematic', label: 'Cinematic', desc: 'Film-inspired dramatic look' },
];

const Portfolio = () => {
  const { profile } = useEnrichedProfile();
  const { data: config, isLoading } = usePortfolioConfig();
  const updateMutation = useUpdatePortfolio();
  const { toast } = useToast();

  const [form, setForm] = useState<any>(null);
  const [slugInput, setSlugInput] = useState('');
  const { data: slugCheck } = useCheckSlug(slugInput);

  // Initialize form from config
  useEffect(() => {
    if (config && !form) {
      setForm({
        slug: config.slug || '',
        theme: config.theme || 'dark',
        accent_color: config.accent_color || '#FF3C3C',
        show_reel: config.show_reel ?? true,
        show_credits: config.show_credits ?? true,
        show_availability: config.show_availability ?? true,
        show_rate_card: config.show_rate_card ?? true,
        show_contact_form: config.show_contact_form ?? true,
        custom_headline: config.custom_headline || '',
        custom_intro: config.custom_intro || '',
        seo_title: config.seo_title || '',
        seo_description: config.seo_description || '',
        is_published: config.is_published || false,
      });
      setSlugInput(config.slug || '');
    }
  }, [config]);

  if (!profile?.is_filmmaker_pro) {
    return (
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-heading text-bone-white mb-6">Portfolio</h1>
        <ProUpgradePrompt feature="Portfolio Site" />
      </div>
    );
  }

  if (isLoading || !form) return <p className="text-muted-gray text-center py-12">Loading...</p>;

  const handleSave = async () => {
    try {
      await updateMutation.mutateAsync({ ...form, slug: slugInput });
      toast({ title: 'Portfolio updated' });
    } catch (e: any) {
      toast({ title: e?.message || 'Error saving', variant: 'destructive' });
    }
  };

  const handlePublishToggle = async () => {
    const newState = !form.is_published;
    setForm({ ...form, is_published: newState });
    try {
      await updateMutation.mutateAsync({ is_published: newState });
      toast({ title: newState ? 'Portfolio published' : 'Portfolio unpublished' });
    } catch {
      setForm({ ...form, is_published: !newState });
      toast({ title: 'Error', variant: 'destructive' });
    }
  };

  const portfolioUrl = `/p/${slugInput || config?.slug}`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-heading text-bone-white">Portfolio Site</h1>
        <div className="flex gap-2">
          {config?.is_published && (
            <Button variant="outline" onClick={() => window.open(portfolioUrl, '_blank')}>
              <ExternalLink className="h-4 w-4 mr-2" />View Site
            </Button>
          )}
          <Button
            className={form.is_published ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}
            onClick={handlePublishToggle}
          >
            {form.is_published ? <><EyeOff className="h-4 w-4 mr-2" />Unpublish</> : <><Eye className="h-4 w-4 mr-2" />Publish</>}
          </Button>
        </div>
      </div>

      {form.is_published && (
        <div className="flex items-center gap-2 bg-green-600/10 border border-green-600/30 rounded-lg p-3">
          <Globe className="h-4 w-4 text-green-400" />
          <p className="text-sm text-green-400">
            Your portfolio is live at <a href={portfolioUrl} className="underline font-medium" target="_blank">{window.location.origin}{portfolioUrl}</a>
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Settings */}
        <div className="space-y-6">
          {/* URL / Slug */}
          <Card className="bg-charcoal-black border-muted-gray">
            <CardHeader><CardTitle className="text-bone-white">URL</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-muted-gray text-sm shrink-0">{window.location.origin}/p/</span>
                <Input value={slugInput} onChange={(e) => setSlugInput(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  className="bg-muted-gray/20 border-muted-gray text-bone-white" />
                {slugInput && slugInput !== config?.slug && (
                  slugCheck?.available
                    ? <Check className="h-4 w-4 text-green-400 shrink-0" />
                    : <X className="h-4 w-4 text-red-400 shrink-0" />
                )}
              </div>
            </CardContent>
          </Card>

          {/* Theme */}
          <Card className="bg-charcoal-black border-muted-gray">
            <CardHeader><CardTitle className="text-bone-white">Theme</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                {THEMES.map((t) => (
                  <button
                    key={t.value}
                    className={`p-3 rounded-lg border text-left transition-colors ${
                      form.theme === t.value
                        ? 'border-amber-500 bg-amber-500/10'
                        : 'border-muted-gray hover:border-muted-gray/70'
                    }`}
                    onClick={() => setForm({ ...form, theme: t.value })}
                  >
                    <p className="text-sm font-medium text-bone-white">{t.label}</p>
                    <p className="text-xs text-muted-gray">{t.desc}</p>
                  </button>
                ))}
              </div>
              <div>
                <Label className="text-bone-white">Accent Color</Label>
                <div className="flex gap-2 items-center">
                  <Input type="color" value={form.accent_color}
                    onChange={(e) => setForm({ ...form, accent_color: e.target.value })}
                    className="w-12 h-10 p-1 bg-transparent border-muted-gray" />
                  <Input value={form.accent_color}
                    onChange={(e) => setForm({ ...form, accent_color: e.target.value })}
                    className="bg-muted-gray/20 border-muted-gray text-bone-white w-28" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Content */}
          <Card className="bg-charcoal-black border-muted-gray">
            <CardHeader><CardTitle className="text-bone-white">Content</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-bone-white">Headline</Label>
                <Input value={form.custom_headline}
                  onChange={(e) => setForm({ ...form, custom_headline: e.target.value })}
                  placeholder="e.g. Award-winning cinematographer"
                  className="bg-muted-gray/20 border-muted-gray text-bone-white" />
              </div>
              <div>
                <Label className="text-bone-white">Intro</Label>
                <Textarea value={form.custom_intro}
                  onChange={(e) => setForm({ ...form, custom_intro: e.target.value })}
                  placeholder="A brief introduction about yourself..."
                  className="bg-muted-gray/20 border-muted-gray text-bone-white" rows={3} />
              </div>
            </CardContent>
          </Card>

          {/* SEO */}
          <Card className="bg-charcoal-black border-muted-gray">
            <CardHeader><CardTitle className="text-bone-white">SEO</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-bone-white">Page Title</Label>
                <Input value={form.seo_title}
                  onChange={(e) => setForm({ ...form, seo_title: e.target.value })}
                  className="bg-muted-gray/20 border-muted-gray text-bone-white" />
              </div>
              <div>
                <Label className="text-bone-white">Meta Description</Label>
                <Textarea value={form.seo_description}
                  onChange={(e) => setForm({ ...form, seo_description: e.target.value })}
                  className="bg-muted-gray/20 border-muted-gray text-bone-white" rows={2} />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Section Toggles */}
        <div className="space-y-6">
          <Card className="bg-charcoal-black border-muted-gray">
            <CardHeader><CardTitle className="text-bone-white">Sections</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {[
                { key: 'show_reel', label: 'Demo Reel', desc: 'Show your featured reel' },
                { key: 'show_credits', label: 'Credits', desc: 'Show your filmography credits' },
                { key: 'show_rate_card', label: 'Rate Card', desc: 'Display public rates' },
                { key: 'show_availability', label: 'Availability', desc: 'Show availability calendar' },
                { key: 'show_contact_form', label: 'Contact Form', desc: 'Allow visitors to send messages' },
              ].map((s) => (
                <div key={s.key} className="flex items-center justify-between py-2">
                  <div>
                    <p className="text-sm text-bone-white font-medium">{s.label}</p>
                    <p className="text-xs text-muted-gray">{s.desc}</p>
                  </div>
                  <Switch checked={form[s.key]} onCheckedChange={(v) => setForm({ ...form, [s.key]: v })} />
                </div>
              ))}
            </CardContent>
          </Card>

          <Button className="w-full bg-amber-500 hover:bg-amber-600 text-charcoal-black font-bold"
            onClick={handleSave} disabled={updateMutation.isPending}>
            Save Changes
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Portfolio;
