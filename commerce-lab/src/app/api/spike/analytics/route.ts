import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const payload = await request.json();
  const receivedFields = collectFieldPaths(payload);
  const phoneReceived = receivedFields.includes('customer.phone');

  return NextResponse.json({
    ok: true,
    phoneReceived,
    receivedFields,
    receivedPayload: payload,
  });
}

function collectFieldPaths(value: unknown, prefix = ''): string[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return prefix ? [prefix] : [];
  }

  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key;

    if (child && typeof child === 'object' && !Array.isArray(child)) {
      const nested = collectFieldPaths(child, path);
      return nested.length > 0 ? nested : [path];
    }

    return [path];
  });
}
