// Shared utility functions and helpers
import { twMerge } from "tailwind-merge";

export const cn = (...classes: (string | undefined | null | false)[]): string => {
  return twMerge(classes.filter(Boolean).join(" "));
};

export const delay = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};
