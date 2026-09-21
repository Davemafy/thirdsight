import{getOrCreateCart}from"@/lib/commerce-store";import{session,withSession}from"@/lib/http";
export async function GET(){const s=await session();return withSession(await getOrCreateCart(s.hash),s.fresh?s.token:undefined);}
export async function POST(){const s=await session();return withSession(await getOrCreateCart(s.hash),s.fresh?s.token:undefined,201);}
