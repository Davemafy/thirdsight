import{NextResponse}from"next/server";import{listCollections}from"@/lib/commerce-store";export async function GET(){return NextResponse.json(await listCollections());}
