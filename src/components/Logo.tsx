export function Logo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <linearGradient id="lg-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#1b2233" />
          <stop offset="1" stopColor="#0c0f16" />
        </linearGradient>
        <linearGradient id="lg-acc" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#82aaff" />
          <stop offset="1" stopColor="#5ee1e6" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="60" height="60" rx="14" fill="url(#lg-bg)" stroke="#ffffff1a" />
      <path d="M17 22 L28 32 L17 42" fill="none" stroke="url(#lg-acc)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="32" y="39" width="16" height="5" rx="2.5" fill="#d6dbe6" />
    </svg>
  );
}
