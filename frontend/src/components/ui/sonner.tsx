import { useTheme } from "next-themes";
import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-charcoal-black group-[.toaster]:text-bone-white group-[.toaster]:border-muted-gray/30 group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-gray",
          actionButton:
            "group-[.toast]:bg-accent-yellow group-[.toast]:text-charcoal-black",
          cancelButton:
            "group-[.toast]:bg-muted-gray/20 group-[.toast]:text-bone-white",
          success: "group-[.toaster]:bg-green-950 group-[.toaster]:text-green-100 group-[.toaster]:border-green-500/30",
          error: "group-[.toaster]:bg-red-950 group-[.toaster]:text-red-100 group-[.toaster]:border-red-500/30",
          warning: "group-[.toaster]:bg-amber-950 group-[.toaster]:text-amber-100 group-[.toaster]:border-amber-500/30",
          info: "group-[.toaster]:bg-blue-950 group-[.toaster]:text-blue-100 group-[.toaster]:border-blue-500/30",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
