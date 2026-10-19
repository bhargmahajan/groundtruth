import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 20,
          background: '#020617', // Slate-950
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#10b981', // Emerald-500
          borderRadius: '25%',
          fontWeight: 900,
          border: '1px solid #10b981',
        }}
      >
        G
      </div>
    ),
    { ...size }
  );
}