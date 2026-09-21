import { NextRequest } from "next/server";
import { managedIngest } from "@/lib/managed-ingest";

export async function POST(req:NextRequest){
  return managedIngest("managed-delivery",req);
}
