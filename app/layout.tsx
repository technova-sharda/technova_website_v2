import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Sora, DM_Sans } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-sora",
  display: "swap",
  weight: ["100", "200", "300", "400", "500", "600", "700", "800"],
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: "#000000",
};

export const metadata: Metadata = {
  metadataBase: new URL("https://www.technovashardauniversity.in"),
  title: {
    default: "Technova - Technical Society | Sharda University",
    template: "%s | Technova Sharda University"
  },
  description: "Technova is the official Technical Society of Sharda University. Join workshops, hackathons, coding competitions, and tech events. Connect with 8+ specialized clubs including AI & Robotics, AWS Cloud, CyberPirates, and more.",
  keywords: [
    "Technova",
    "Technova Sharda",
    "Technova Sharda University",
    "Technical Society Sharda",
    "Sharda University Tech Club",
    "Sharda University Technical Society",
    "Tech Events Sharda",
    "Hackathon Sharda University",
    "Coding Club Sharda",
    "AI Robotics Club Sharda",
    "AWS Cloud Club Sharda",
    "CyberPirates Sharda",
    "GitHub Club Sharda",
    "GDG on Campus Sharda",
    "Technova Events",
    "Technova Workshops",
    "Greater Noida Tech Society"
  ],
  authors: [{ name: "Technova Technical Society", url: "https://www.technovashardauniversity.in" }],
  creator: "Technova Technical Society",
  publisher: "Sharda University",
  applicationName: "Technova",
  generator: "Next.js",
  referrer: "origin-when-cross-origin",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  // Transparent blue logo (app/icon.png). The old /assets/logo/technova.png has a
  // white background baked in, which showed as a white square in browser tabs.
  icons: {
    icon: [{ url: "/icon.png?v=3", type: "image/png", sizes: "500x500" }],
    shortcut: "/favicon.ico?v=3",
    apple: "/icons/icon-192.png?v=3",
  },
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: "https://www.technovashardauniversity.in",
    siteName: "Technova Technical Society",
    title: "Technova - Official Technical Society of Sharda University",
    description: "Technova is the official Technical Society of Sharda University. Join workshops, hackathons, coding competitions, and tech events with 8+ specialized clubs.",
    images: [
      {
        url: "/assets/logo/technova.png",
        width: 512,
        height: 512,
        alt: "Technova Technical Society Logo"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: "Technova - Technical Society | Sharda University",
    description: "Join Technova, the official Technical Society of Sharda University. Workshops, hackathons, tech events & more!",
    images: ["/assets/logo/technova.png"],
    creator: "@technova_sharda"
  },
  robots: {
    index: true,
    follow: true,
    nocache: false,
    googleBot: {
      index: true,
      follow: true,
      noimageindex: false,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  alternates: {
    canonical: "https://www.technovashardauniversity.in",
  },
  category: "technology",
  verification: {
    // Add your verification codes here when you have them
    // google: "your-google-verification-code",
    // yandex: "your-yandex-verification-code",
  },
};

// JSON-LD Structured Data for Organization
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Technova Technical Society",
  alternateName: ["Technova", "Technova Sharda", "Technova Sharda University"],
  url: "https://www.technovashardauniversity.in",
  logo: "https://www.technovashardauniversity.in/assets/logo/technova.png",
  description: "Technova is the official Technical Society of Sharda University, Greater Noida. We organize workshops, hackathons, coding competitions, and tech events.",
  foundingDate: "2020",
  parentOrganization: {
    "@type": "EducationalOrganization",
    name: "Sharda University",
    url: "https://www.sharda.ac.in"
  },
  address: {
    "@type": "PostalAddress",
    streetAddress: "Plot No. 32-34, Knowledge Park III",
    addressLocality: "Greater Noida",
    addressRegion: "Uttar Pradesh",
    postalCode: "201310",
    addressCountry: "IN"
  },
  sameAs: [
    "https://www.instagram.com/technova_sharda/",
    "https://www.linkedin.com/company/technova-sharda-university/",
    "https://github.com/technova-sharda"
  ],
  numberOfEmployees: {
    "@type": "QuantitativeValue",
    minValue: 50,
    maxValue: 100
  },
  subOrganization: [
    { "@type": "Organization", name: "AI & Robotics Club" },
    { "@type": "Organization", name: "AWS Cloud Club" },
    { "@type": "Organization", name: "CyberPirates" },
    { "@type": "Organization", name: "Datapool" },
    { "@type": "Organization", name: "Game Drifters" },
    { "@type": "Organization", name: "GitHub Club" },
    { "@type": "Organization", name: "GDG on Campus" },
    { "@type": "Organization", name: "PiXelance" }
  ]
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${sora.variable} ${dmSans.variable} antialiased`}
        suppressHydrationWarning
      >
        {children}
        {/* 48 toast() calls in the admin forms and evaluator portal had no Toaster to render into. */}
        <Toaster theme="dark" position="top-center" richColors closeButton />
      </body>
    </html>
  );
}
