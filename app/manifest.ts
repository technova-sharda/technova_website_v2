import type { MetadataRoute } from "next"

/** Lets students "Add to Home Screen" / install the site as an app. */
export default function manifest(): MetadataRoute.Manifest {
    return {
        name: "Technova – Sharda University",
        short_name: "Technova",
        description: "Events, tickets, certificates and clubs of Technova, the technical society of Sharda University.",
        start_url: "/dashboard",
        scope: "/",
        display: "standalone",
        background_color: "#000000",
        theme_color: "#000000",
        orientation: "portrait",
        icons: [
            { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
            { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
            { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
            { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
        shortcuts: [
            { name: "Events", url: "/events" },
            { name: "My dashboard", url: "/dashboard" },
            { name: "My certificates", url: "/dashboard/certificates" },
        ],
    }
}
