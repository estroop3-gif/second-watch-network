import { useEffect, useRef } from "react";

const Donations = () => {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  useEffect(() => {
    // Inject Donorbox widget script once
    const existing = document.querySelector<HTMLScriptElement>('script#donorbox-widget');
    if (!existing) {
      const script = document.createElement("script");
      script.id = "donorbox-widget";
      script.src = "https://donorbox.org/widget.js";
      script.setAttribute("paypalExpress", "false");
      script.async = true;
      document.body.appendChild(script);
    }

    // Ensure the iframe gets the allowpaymentrequest attribute
    if (iframeRef.current) {
      iframeRef.current.setAttribute("allowpaymentrequest", "allowpaymentrequest");
    }
  }, []);

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <h1 className="text-3xl font-heading tracking-tight">Support Second Watch</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Your donation helps us fund more creators and projects.
          </p>
        </div>
        <iframe
          ref={iframeRef}
          src="https://donorbox.org/embed/help-fund-second-watch-network?"
          name="donorbox"
          seamless
          frameBorder={0}
          scrolling="no"
          height="900px"
          width="100%"
          style={{ maxWidth: "500px", minWidth: "250px", maxHeight: "none" }}
          allow="payment"
          className="mx-auto block"
          title="Donate to Second Watch Network"
        />
      </div>
    </div>
  );
};

export default Donations;