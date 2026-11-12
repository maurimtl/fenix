import { redirect } from "next/navigation";

// proxy.ts sends / to the last-used person; this only runs if it could not.
export default function Home() {
  redirect("/profiles");
}
