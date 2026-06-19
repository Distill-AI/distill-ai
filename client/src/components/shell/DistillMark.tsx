interface DistillMarkProps {
  size?: number;
  color?: string;
}

export function DistillMark({ size = 18, color = '#fff' }: DistillMarkProps) {
  const height = Math.round(size * 1.154);
  const showDots = size > 24;

  return (
    <svg width={size} height={height} viewBox="0 0 52 60" fill="none" aria-hidden="true">
      {showDots && (
        <>
          <circle cx="20" cy="6" r="1.6" fill={color} />
          <circle cx="27" cy="5" r="1.6" fill={color} />
          <circle cx="34" cy="6.5" r="1.6" fill={color} />
          <circle cx="16" cy="11" r="1.6" fill={color} />
          <circle cx="23" cy="10" r="1.6" fill={color} />
          <circle cx="30" cy="10.5" r="1.6" fill={color} />
          <circle cx="37" cy="11.5" r="1.6" fill={color} />
        </>
      )}
      {/* funnel body: wide top (x 8 to 44), narrows to 6-unit neck at bottom (x 23 to 29) */}
      <path d="M8 18 H44 L29 38 H23 L8 18 Z" fill={color} />
      {/* droplet below the neck */}
      <path d="M26 40 C26 40 20 48 20 52 a6 6 0 0 0 12 0 C32 48 26 40 26 40 Z" fill={color} />
    </svg>
  );
}
