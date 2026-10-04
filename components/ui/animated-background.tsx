'use client'

/**
 * AnimatedBackground — Fixed-position, CSS-only animated mesh gradient
 * with floating geometric shapes. Sits behind all page content.
 * 
 * Design engineering: no JS animation loop, pure CSS transforms.
 * prefers-reduced-motion: stops all movement.
 */
export function AnimatedBackground() {
  return (
    <div
      className="fixed inset-0 z-0 pointer-events-none overflow-hidden"
      aria-hidden="true"
    >
      {/* ── Mesh Gradient Blobs ── */}
      <div className="absolute inset-0">
        {/* Amber blob — top-left */}
        <div
          className="absolute w-[600px] h-[600px] rounded-full animate-mesh-drift"
          style={{
            top: '-10%',
            left: '-5%',
            background: 'radial-gradient(circle, rgba(245,166,35,0.07) 0%, transparent 70%)',
            filter: 'blur(80px)',
          }}
        />
        {/* Indigo blob — center-right */}
        <div
          className="absolute w-[500px] h-[500px] rounded-full animate-mesh-drift-reverse"
          style={{
            top: '30%',
            right: '-10%',
            background: 'radial-gradient(circle, rgba(99,102,241,0.06) 0%, transparent 70%)',
            filter: 'blur(100px)',
          }}
        />
        {/* Green blob — bottom-left */}
        <div
          className="absolute w-[400px] h-[400px] rounded-full animate-mesh-drift"
          style={{
            bottom: '5%',
            left: '10%',
            background: 'radial-gradient(circle, rgba(34,197,94,0.04) 0%, transparent 70%)',
            filter: 'blur(90px)',
            animationDelay: '-8s',
          }}
        />
        {/* Secondary amber — bottom-right */}
        <div
          className="absolute w-[550px] h-[550px] rounded-full animate-mesh-drift-reverse"
          style={{
            bottom: '-15%',
            right: '5%',
            background: 'radial-gradient(circle, rgba(245,166,35,0.05) 0%, transparent 70%)',
            filter: 'blur(100px)',
            animationDelay: '-4s',
          }}
        />
      </div>

      {/* ── Subtle Dot Grid ── */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `radial-gradient(rgba(255,255,255,0.5) 1px, transparent 1px)`,
          backgroundSize: '32px 32px',
        }}
      />

      {/* ── Floating Geometric Shapes ── */}
      <div className="absolute inset-0">
        {/* Hexagon outline — top right area */}
        <svg
          className="absolute animate-float-shape opacity-[0.04]"
          style={{ top: '15%', right: '20%', animationDelay: '0s' }}
          width="80" height="80" viewBox="0 0 80 80"
        >
          <polygon
            points="40,2 74,20 74,60 40,78 6,60 6,20"
            fill="none"
            stroke="rgba(245,166,35,0.8)"
            strokeWidth="1"
          />
        </svg>

        {/* Circle outline — mid-left */}
        <svg
          className="absolute animate-float-shape opacity-[0.03]"
          style={{ top: '45%', left: '8%', animationDelay: '-3s' }}
          width="60" height="60" viewBox="0 0 60 60"
        >
          <circle cx="30" cy="30" r="28" fill="none" stroke="rgba(99,102,241,0.8)" strokeWidth="1" />
        </svg>

        {/* Triangle — bottom-right area */}
        <svg
          className="absolute animate-float-shape opacity-[0.04]"
          style={{ bottom: '25%', right: '12%', animationDelay: '-7s' }}
          width="50" height="50" viewBox="0 0 50 50"
        >
          <polygon
            points="25,3 48,47 2,47"
            fill="none"
            stroke="rgba(34,197,94,0.6)"
            strokeWidth="1"
          />
        </svg>

        {/* Diamond — top-left area */}
        <svg
          className="absolute animate-float-shape opacity-[0.03]"
          style={{ top: '60%', left: '30%', animationDelay: '-5s' }}
          width="40" height="40" viewBox="0 0 40 40"
        >
          <polygon
            points="20,2 38,20 20,38 2,20"
            fill="none"
            stroke="rgba(245,166,35,0.6)"
            strokeWidth="1"
          />
        </svg>

        {/* Cross / Plus — mid-right */}
        <svg
          className="absolute animate-float-shape opacity-[0.03]"
          style={{ top: '75%', right: '35%', animationDelay: '-10s' }}
          width="36" height="36" viewBox="0 0 36 36"
        >
          <line x1="18" y1="4" x2="18" y2="32" stroke="rgba(99,102,241,0.6)" strokeWidth="1" />
          <line x1="4" y1="18" x2="32" y2="18" stroke="rgba(99,102,241,0.6)" strokeWidth="1" />
        </svg>

        {/* Small square — near top center */}
        <svg
          className="absolute animate-float-shape opacity-[0.03]"
          style={{ top: '8%', left: '50%', animationDelay: '-2s' }}
          width="24" height="24" viewBox="0 0 24 24"
        >
          <rect x="2" y="2" width="20" height="20" fill="none" stroke="rgba(245,166,35,0.5)" strokeWidth="1" rx="2" />
        </svg>
      </div>

      {/* ── Animated scan line (very subtle) ── */}
      <div
        className="absolute top-0 left-0 right-0 h-px animate-scanline opacity-[0.03]"
        style={{
          background: 'linear-gradient(90deg, transparent, rgba(245,166,35,0.5), transparent)',
        }}
      />
    </div>
  )
}
