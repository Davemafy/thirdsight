import{NextResponse}from"next/server";import{getProduct}from"@/lib/commerce-store";
export async function GET(_:Request,{params}:{params:Promise<{slug:string}>}){const p=await getProduct((await params).slug);return p?NextResponse.json(p):NextResponse.json({error:"PRODUCT_NOT_FOUND"},{status:404});}
