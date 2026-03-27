"use client";

export default function OfflineBanner() {
  return (
    <div style={{
      padding: '6px 16px',
      background: 'rgba(245, 158, 11, 0.1)',
      borderBottom: '1px solid rgba(245, 158, 11, 0.2)',
      color: '#fbbf24',
      fontSize: '12px',
      fontWeight: 600,
      textAlign: 'center',
      letterSpacing: '0.02em',
    }}>
      Offline — Interpretation requires an internet connection
    </div>
  );
}
