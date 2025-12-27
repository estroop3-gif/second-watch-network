import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ShoppingCart, Filter, Tag, Shirt, BadgePercent } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { AspectRatio } from "@/components/ui/aspect-ratio";

type Product = {
  id: number;
  title: string;
};

const DUMMY_PRODUCTS: Product[] = Array.from({ length: 8 }).map((_, i) => ({
  id: i + 1,
  title: ["T‑Shirt Name", "Hoodie Name", "Cap Name", "Sticker Pack", "Crewneck Name", "Beanie Name", "Poster Name", "Tote Name"][i] || "Product Name",
}));

const Shop: React.FC = () => {
  const [email, setEmail] = useState("");
  const [loadingGrid, setLoadingGrid] = useState(true);

  // SEO
  useEffect(() => {
    document.title = "Second Watch Network Shop — Coming Soon";
    const metaDesc = document.querySelector('meta[name="description"]') || (() => {
      const m = document.createElement("meta");
      m.setAttribute("name", "description");
      document.head.appendChild(m);
      return m;
    })();
    metaDesc.setAttribute("content", "Official Second Watch Network merch is almost here. Preview the shop and join the waitlist.");
  }, []);

  // Simulate loading for skeleton preview
  useEffect(() => {
    const t = setTimeout(() => setLoadingGrid(false), 600);
    return () => clearTimeout(t);
  }, []);

  const products = useMemo(() => DUMMY_PRODUCTS, []);

  const onNotify = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error("Please enter your email.");
      return;
    }
    toast.success("You’re on the list!");
    setEmail("");
  };

  const DisabledSelect = ({ placeholder }: { placeholder: string }) => (
    <Tooltip>
      <TooltipTrigger asChild>
        <div aria-disabled="true" className="w-full cursor-not-allowed opacity-60">
          <Select>
            <SelectTrigger disabled>
              <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="placeholder">Placeholder</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </TooltipTrigger>
      <TooltipContent>Filters coming soon</TooltipContent>
    </Tooltip>
  );

  return (
    <div className="min-h-screen bg-charcoal-black text-bone-white">
      <div className="container mx-auto px-4 py-8 md:py-10">
        {/* Header */}
        <header className="mb-6 md:mb-8 flex items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 mb-3">
              <Badge variant="outline" className="uppercase tracking-wider">Coming Soon</Badge>
              <span className="text-xs text-muted-foreground">Preview only</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-heading">Shop (Coming Soon)</h1>
            <p className="text-sm md:text-base text-muted-foreground mt-1">
              Merch is on the way. Browse the layout and join the waitlist.
            </p>
          </div>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                aria-label="Cart (coming soon)"
                aria-disabled="true"
                className="relative inline-flex items-center justify-center rounded-md border border-muted-gray/60 px-3 py-2 text-sm text-muted-foreground cursor-not-allowed opacity-70"
              >
                <ShoppingCart className="h-5 w-5" />
                <span className="sr-only">Cart coming soon</span>
                <span className="ml-2">Cart</span>
                <span className="ml-2 inline-flex items-center justify-center rounded-full bg-muted-gray/40 text-xs px-2 py-0.5">
                  0
                </span>
              </button>
            </TooltipTrigger>
            <TooltipContent>Cart coming soon</TooltipContent>
          </Tooltip>
        </header>

        {/* Filters Bar (non-functional) */}
        <section aria-label="Filters" className="mb-6 md:mb-8">
          <Card className="bg-transparent border-2 border-muted-gray/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-base md:text-lg flex items-center gap-2">
                <Filter className="h-4 w-4" />
                Filters
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">All controls are previews</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <DisabledSelect placeholder="Category: All" />
                <DisabledSelect placeholder="Size" />
                <DisabledSelect placeholder="Color" />
                <DisabledSelect placeholder="Sort by: Low–High" />
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Featured Banner */}
        <section aria-label="Featured" className="mb-6 md:mb-8">
          <div className="relative overflow-hidden rounded-lg border-2 border-dashed border-muted-gray p-5 md:p-7">
            <div className="flex items-center gap-3">
              <Badge variant="premium" className="uppercase">Coming Soon</Badge>
              <span className="text-sm text-muted-foreground">Sneak peek of our storefront</span>
            </div>
            <div className="mt-2 text-lg md:text-xl font-heading">Exclusive designs dropping soon.</div>
          </div>
        </section>

        {/* Waitlist */}
        <section aria-label="Waitlist signup" className="mb-8 md:mb-10">
          <form onSubmit={onNotify} className="flex flex-col sm:flex-row items-stretch gap-3 max-w-xl">
            <div className="flex-1">
              <label htmlFor="notify-email" className="sr-only">Email address</label>
              <Input
                id="notify-email"
                type="email"
                placeholder="you@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-charcoal-black border-muted-gray"
              />
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="submit"
                  className="bg-accent-yellow text-charcoal-black hover:bg-bone-white hover:text-charcoal-black font-bold rounded-[4px] uppercase"
                >
                  Notify Me
                </Button>
              </TooltipTrigger>
              <TooltipContent>Join the waitlist preview</TooltipContent>
            </Tooltip>
          </form>
        </section>

        {/* Products Grid */}
        <section aria-label="Products">
          <div
            role="list"
            className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5"
          >
            {loadingGrid
              ? Array.from({ length: 8 }).map((_, i) => (
                  <Card key={`skeleton-${i}`} className="bg-transparent border-2 border-muted-gray/50">
                    <CardContent className="p-0">
                      <AspectRatio ratio={16 / 9}>
                        <Skeleton className="w-full h-full" />
                      </AspectRatio>
                      <div className="p-4 space-y-3">
                        <Skeleton className="h-5 w-3/4" />
                        <Skeleton className="h-4 w-1/3" />
                        <Skeleton className="h-9 w-full" />
                      </div>
                    </CardContent>
                  </Card>
                ))
              : products.map((p) => (
                  <Card key={p.id} className="bg-transparent border-2 border-muted-gray/50 hover:border-muted-gray transition-colors">
                    <CardContent className="p-0">
                      <AspectRatio ratio={16 / 9}>
                        <div className="w-full h-full bg-muted-gray/30 flex items-center justify-center">
                          <Shirt className="h-10 w-10 text-muted-foreground" />
                        </div>
                      </AspectRatio>
                      <div className="p-4">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base">{p.title}</CardTitle>
                          <span className="text-sm text-muted-foreground">$—.—</span>
                        </div>
                        <CardDescription className="mt-1 text-xs flex items-center gap-2">
                          <Tag className="h-3.5 w-3.5" /> Prototype
                        </CardDescription>
                        <div className="mt-3">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-block w-full">
                                <Button
                                  disabled
                                  aria-disabled="true"
                                  className="w-full cursor-not-allowed bg-muted-gray/30 text-muted-foreground hover:bg-muted-gray/40"
                                >
                                  <BadgePercent className="h-4 w-4 mr-2" />
                                  Add to Cart
                                </Button>
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>Cart coming soon</TooltipContent>
                          </Tooltip>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
          </div>
        </section>

        {/* Footer note */}
        <footer className="mt-10 md:mt-12 text-xs text-muted-foreground">
          Designs are prototypes. Final items may vary.
        </footer>
      </div>
    </div>
  );
};

export default Shop;