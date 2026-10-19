import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Executes a lightweight query to keep DB alive and test connection
  const { data, error } = await supabase.from('hex_zones').select('count', { count: 'exact', head: true });

  if (error) {
    return NextResponse.json({ status: 'ERROR', message: error.message }, { status: 500 });
  }

  return NextResponse.json({
    status: 'HEALTHY',
    timestamp: new Date().toISOString(),
    database: 'CONNECTED',
  });
}