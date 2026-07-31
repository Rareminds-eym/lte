import type React from "react";
import { Image } from "@/shared/ui/Image";

interface ApplicationLoaderProps {
  /** Short contextual message shown below the spinner */
  message?: string;
}

/**
 * Full-screen application bootstrap loader.
 *
 * Use ONLY when the application shell itself cannot render safely:
 *   - LTE is bootstrapping
 *   - Authentication is initializing
 *   - SSO is being verified
 *   - Required application config is loading
 *
 * Do NOT use this for page data loading — use skeletons for that.
 */
export const ApplicationLoader: React.FC<ApplicationLoaderProps> = ({ message = "Loading…" }) => (
  <div
    className="flex flex-col items-center justify-center min-h-screen w-full bg-surface-primary"
    role="status"
    aria-live="polite"
    aria-label={message}
    data-testid="application-loader"
  >
    <div className="text-center">
      {/* Branded spinner */}
      <div className="relative inline-block">
        <div className="inline-block animate-spin rounded-full h-16 w-16 border-4 border-brand-200 border-t-brand-600" />
        <Image
          src="/assets/images/rm-bulb.webp"
          alt="Rareminds"
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 object-contain"
          loading="eager"
        />
      </div>

      {/* Message */}
      <div className="mt-6">
        <p className="text-xl font-semibold text-content-heading mb-2">{message}</p>
        <p className="text-sm text-content-secondary">
          Powered by <span className="font-semibold text-brand-600">Rareminds</span>
        </p>
      </div>
    </div>
  </div>
);
