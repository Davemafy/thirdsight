import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { hashToken, newSessionToken } from "./security";
import { allowMutation } from "./rate-limit";

export const CART_COOKIE="cedar_cart";
export async function session(){const jar=await cookies();let token=jar.get(CART_COOKIE)?.value;let fresh=false;if(!token){token=newSessionToken();fresh=true;}return{token,hash:hashToken(token),fresh};}
export function withSession<T>(body:T,token?:string,status=200){const response=NextResponse.json(body,{status});if(token)response.cookies.set(CART_COOKIE,token,{httpOnly:true,sameSite:"lax",secure:process.env.NODE_ENV==="production",path:"/",maxAge:60*60*24*30});return response;}
export function apiError(error:unknown){const e=error as{code?:string;status?:number;message?:string};return NextResponse.json({error:e.code??"INTERNAL_ERROR",message:e.status&&e.status<500?e.message:"The request could not be completed."},{status:e.status??500});}
export function mutationAllowed(request:NextRequest){const ip=request.headers.get("x-forwarded-for")?.split(",")[0]??"local";return allowMutation(ip);}
