// The product's brand in one place. To rebrand, change the values here, replace the favicon (an inline SVG with the letter T) and the <title> in index.html,
// then search the app for the old name: a few sentences of copy (about 30, mostly in src/components and src/routes) still spell it
// out. The staff console has its own name in apps/admin/app/_components/ops-shell.tsx and layout.tsx.
import type { ReactNode } from "react";

export const brand = {
  name: "TwiPay",
  operator: "Octalve",
  // A picture logo. Leave null to show the name as a text wordmark; to use a picture, import it and put it here:
  //   import logo from "@/assets/brand/logo.png";   ...   logoImage: logo,
  logoImage: null as string | null,
} as const;

export type BrandLogoContent = ReactNode;
