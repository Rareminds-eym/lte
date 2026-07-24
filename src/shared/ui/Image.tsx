import type { ImgHTMLAttributes, ReactNode } from "react";
import { cn } from "@/shared/lib";

interface ImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, "loading" | "decoding"> {
  aspectRatio?: string;
  priority?: boolean;
  loading?: "eager" | "lazy";
  wrapperClassName?: string;
  children?: ReactNode;
}

export const Image: React.FC<ImageProps> = ({
  aspectRatio,
  priority = false,
  loading: explicitLoading,
  wrapperClassName,
  className,
  children,
  alt,
  ...props
}) => {
  const imgProps = {
    ...props,
    loading: (explicitLoading ?? (priority ? "eager" : "lazy")) as "eager" | "lazy",
    decoding: "async" as const,
    fetchPriority: priority ? ("high" as const) : undefined,
  };

  if (aspectRatio) {
    return (
      <div className={cn("relative overflow-hidden", wrapperClassName)} style={{ aspectRatio }}>
        <img alt={alt} {...imgProps} className={cn("w-full h-full object-cover", className)} />
        {children}
      </div>
    );
  }

  if (children) {
    return (
      <div className={cn("relative", wrapperClassName)}>
        <img alt={alt} {...imgProps} className={className} />
        {children}
      </div>
    );
  }

  return <img alt={alt} {...imgProps} className={className} />;
};
