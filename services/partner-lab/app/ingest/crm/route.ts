import{NextRequest}from"next/server";import{ingest}from"@/lib/ingest";export async function POST(req:NextRequest){return ingest("crm",req)}
