import Link from 'next/link'
import { Instagram, Linkedin, Mail, MapPin } from 'lucide-react'

export function Footer() {
  return (
    <footer className="relative pt-12 md:pt-20 pb-10 border-t border-[var(--sig-border)]">
      <div className="container mx-auto px-6 lg:px-16">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-12 mb-16">

          {/* Logo + Address */}
          <div className="col-span-1 md:col-span-2 lg:col-span-1">
            <div className="flex items-center gap-4 mb-6">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/assets/logo/technova-white.png" alt="Technova Logo" className="h-9 w-auto object-contain" />
              <div className="h-8 w-px bg-[var(--sig-border)]" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/assets/logo/sharda.png" alt="Sharda University" className="h-9 w-auto object-contain bg-white rounded-sm p-1" />
            </div>
            <p className="text-[var(--sig-text-secondary)] text-xs font-medium uppercase tracking-wider leading-relaxed mb-6">
              Sharda School of Computing Science and Engineering, Knowledge Park III, Greater Noida, UP 201310
            </p>
            <div className="flex gap-3">
              {[
                { icon: Instagram, href: "https://www.instagram.com/technova_sharda/" },
                { icon: Linkedin, href: "https://www.linkedin.com/company/technova-su/" },
                { icon: Mail, href: "mailto:technova@sharda.ac.in" }
              ].map((social, i) => (
                <Link
                  key={i}
                  href={social.href}
                  target="_blank"
                  className="w-10 h-10 rounded-lg border border-[var(--sig-border)] bg-[var(--sig-surface)] flex items-center justify-center text-[var(--sig-text-secondary)] hover:bg-[var(--sig-amber)] hover:text-black hover:border-transparent transition-all duration-200 spring-btn"
                  style={{ transitionTimingFunction: 'var(--ease-out)' }}
                >
                  <social.icon className="w-4 h-4" />
                </Link>
              ))}
            </div>
          </div>

          {/* Index */}
          <div>
            <h4 className="font-heading font-bold text-sm text-[var(--sig-text)] uppercase mb-6 tracking-wider">Navigation</h4>
            <ul className="space-y-3">
              {[
                { label: 'Events', href: '/events' },
                { label: 'Clubs', href: '/clubs' },
                { label: 'Leadership', href: '/leadership' },
                { label: 'Login', href: '/login' },
              ].map(link => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-[var(--sig-text-secondary)] hover:text-[var(--sig-amber)] font-medium transition-colors duration-200 text-sm relative group"
                  >
                    {link.label}
                    <span className="absolute left-0 -bottom-0.5 w-0 h-px bg-[var(--sig-amber)] transition-all duration-300 group-hover:w-full" style={{ transitionTimingFunction: 'var(--ease-out)' }} />
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-heading font-bold text-sm text-[var(--sig-text)] uppercase mb-6 tracking-wider">Contact</h4>
            <ul className="space-y-4">
              <li>
                <Link href="https://maps.app.goo.gl/BpCDyGPHZvGwAoPs8" target="_blank" className="flex items-start gap-3 text-[var(--sig-text-secondary)] text-sm hover:text-[var(--sig-indigo)] transition-colors duration-200 group">
                  <MapPin className="w-4 h-4 text-[var(--sig-text-secondary)] group-hover:text-[var(--sig-indigo)] shrink-0 mt-0.5 transition-colors" />
                  <span className="font-medium">Knowledge Park III, Greater Noida</span>
                </Link>
              </li>
              <li>
                <Link href="mailto:technova@sharda.ac.in" className="flex items-center gap-3 text-[var(--sig-text-secondary)] text-sm hover:text-[var(--sig-indigo)] transition-colors duration-200 group">
                  <Mail className="w-4 h-4 text-[var(--sig-text-secondary)] group-hover:text-[var(--sig-indigo)] shrink-0 transition-colors" />
                  <span className="font-medium">technova@sharda.ac.in</span>
                </Link>
              </li>
            </ul>
          </div>

          {/* Map */}
          <div className="col-span-1 md:col-span-2 lg:col-span-1">
            <h4 className="font-heading font-bold text-sm text-[var(--sig-text)] uppercase mb-6 tracking-wider">Location</h4>
            <div className="border border-[var(--sig-border)] rounded-lg bg-[var(--sig-surface)] p-1 hover:border-[var(--sig-border-hover)] transition-colors duration-300 overflow-hidden grayscale hover:grayscale-0">
              <iframe
                src="https://www.google.com/maps?q=Sharda+University,+Knowledge+Park+III,+Greater+Noida,+Uttar+Pradesh&output=embed"
                width="100%"
                height="150"
                style={{ border: 0 }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title="Sharda University Location"
                className="w-full rounded mix-blend-screen"
              />
            </div>
          </div>
        </div>

        <div className="border-t border-[var(--sig-border)] pt-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="text-[var(--sig-text-secondary)] font-medium text-xs tracking-wider">
            &copy; {new Date().getFullYear()} Technova Technical Society — Sharda University
          </div>
          <div className="text-[var(--sig-text-secondary)]/50 font-medium text-xs tracking-wider">
            Built with intention.
          </div>
        </div>
      </div>
    </footer>
  )
}
