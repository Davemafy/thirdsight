import type { Metadata } from "next";
import "./globals.css";

export const metadata:Metadata={title:{default:"CEDAR Commerce",template:"%s | CEDAR"},description:"Premium consumer technology with clear Nigerian delivery and local support.",icons:{icon:"/favicon.svg"}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
