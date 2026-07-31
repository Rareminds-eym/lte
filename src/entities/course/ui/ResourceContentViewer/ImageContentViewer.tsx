import type React from "react";
import { Image } from "@/shared/ui";
import type { ResourceRendererProps } from "./types";

export const ImageContentViewer: React.FC<ResourceRendererProps> = ({ item }) => (
  <div className="flex h-full w-full overflow-auto bg-surface-primary">
    <Image
      alt={item.title}
      className="block h-full w-full object-contain"
      loading="eager"
      src={item.url}
    />
  </div>
);
