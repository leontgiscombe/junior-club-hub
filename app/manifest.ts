import type { MetadataRoute } from "next";
import { getClubWithIcons } from "@/lib/settings";

// How the hub looks when added to a phone's home screen, from the saved settings.
export const dynamic = "force-dynamic";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const { club, icons } = await getClubWithIcons();
  return {
    name: `${club.name} Team Hub`,
    short_name: `${club.initials} Hub`,
    start_url: "/",
    display: "standalone",
    background_color: "#060906",
    theme_color: "#060906",
    icons: [
      { src: icons.apple, sizes: "180x180", type: "image/png" },
      { src: icons.large, sizes: "512x512", type: "image/png" },
    ],
  };
}
