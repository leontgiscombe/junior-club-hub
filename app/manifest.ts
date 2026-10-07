import type { MetadataRoute } from "next";
import { CLUB } from "@/club.config";

// How the hub looks when added to a phone's home screen.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${CLUB.name} Team Hub`,
    short_name: `${CLUB.initials} Hub`,
    start_url: "/",
    display: "standalone",
    background_color: "#060906",
    theme_color: "#060906",
    icons: [
      { src: "/hub-icon-180.png", sizes: "180x180", type: "image/png" },
      { src: "/hub-icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
