import{NextResponse}from"next/server";import{listAccountOrders}from"@/lib/commerce-store";export async function GET(){return NextResponse.json(await listAccountOrders());}
