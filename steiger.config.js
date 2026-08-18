import { defineConfig } from "steiger";
import fsd from "@feature-sliced/steiger-plugin";

export default defineConfig([
  ...fsd.configs.recommended,
  {
    rules: {
      // Disable noisy rules that represent standard React/project conventions
      "fsd/no-reserved-folder-names": "off",
      "fsd/segments-by-purpose": "off",
    },
  },
]);
