import { AppHeader } from "@/components/app-header";

/** The app header for server pages. */
export function SiteHeader({ children }: { profile: string; children?: React.ReactNode }) {
  return <AppHeader>{children}</AppHeader>;
}
