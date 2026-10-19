import { NextResponse } from 'next/server';
import { Receiver } from '@upstash/qstash';

// Initialize signature receiver for security
const receiver = new Receiver({
  currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY || '',
  nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY || '',
});

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get('upstash-signature');

    // 1. Verify QStash Signature (skip in local testing if keys are not yet configured)
    if (process.env.NODE_ENV === 'production' && signature) {
      const isValid = await receiver.verify({
        signature,
        body: rawBody,
      });

      if (!isValid) {
        return NextResponse.json({ error: 'Invalid QStash signature' }, { status: 401 });
      }
    }

    const payload = JSON.parse(rawBody || '{}');
    console.log('QStash worker job received:', payload);

    // 2. Return HTTP 200 immediately so QStash registers successful delivery
    return NextResponse.json({ success: true, receivedAt: new Date().toISOString() });
  } catch (error: any) {
    console.error('QStash webhook handler error:', error);
    return NextResponse.json({ error: error.message || 'Worker processing failed' }, { status: 500 });
  }
}

// Ensure GET requests return 200/405 cleanly rather than an unhandled error
export async function GET() {
  return NextResponse.json({ status: 'QStash endpoint active. Send POST requests.' });
}