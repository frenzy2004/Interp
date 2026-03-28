import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'Interp — Human-verified AI medical interpretation';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function Image() {
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
          gap: '24px',
        }}
      >
        <div
          style={{
            fontSize: '120px',
            fontWeight: 800,
            letterSpacing: '-0.04em',
            background: 'linear-gradient(135deg, #3b82f6, #6366f1, #f97316)',
            backgroundClip: 'text',
            color: 'transparent',
          }}
        >
          interp
        </div>
        <div
          style={{
            fontSize: '32px',
            color: '#94a3b8',
            letterSpacing: '0.05em',
          }}
        >
          Human-verified AI medical interpretation
        </div>
      </div>
    ),
    { ...size }
  );
}
