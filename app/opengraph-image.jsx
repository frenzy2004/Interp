import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'Interp — Human-verified AI medical interpretation';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function Image() {
  const letters = [
    { char: 'i', color: '#3b82f6' },
    { char: 'n', color: '#4f6ef3' },
    { char: 't', color: '#5a5ef0' },
    { char: 'e', color: '#7c5cda' },
    { char: 'r', color: '#c4652a' },
    { char: 'p', color: '#f97316' },
  ];

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0a0a0f',
          gap: '32px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline' }}>
          {letters.map((l, i) => (
            <span
              key={i}
              style={{
                fontSize: '140px',
                fontWeight: 800,
                letterSpacing: '-0.04em',
                color: l.color,
              }}
            >
              {l.char}
            </span>
          ))}
        </div>
        <div
          style={{
            fontSize: '30px',
            color: '#64748b',
            letterSpacing: '0.08em',
          }}
        >
          Beyond translation, into interpretation
        </div>
      </div>
    ),
    { ...size }
  );
}
