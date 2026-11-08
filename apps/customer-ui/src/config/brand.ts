// The product's brand in one place. To rebrand, change the values here, replace the favicon (an inline SVG with the letter T) and the
// <title> and description in index.html (static HTML cannot read this file). All user-visible copy in src reads brand.name; a test
// fails if a literal copy of the old name creeps back into code. Comments may still use it. The staff console has its own name in
// apps/admin/app/_components/ops-shell.tsx and layout.tsx.
import type { ReactNode } from "react";

export const brand = {
  name: "TwiPay",
  operator: "Octalve",
  // A picture logo. Leave null to show the name as a text wordmark; to use a picture, import it and put it here:
  //   import logo from "@/assets/brand/logo.png";   ...   logoImage: logo,
  logoImage: null as string | null,
} as const;

export type BrandLogoContent = ReactNode;
