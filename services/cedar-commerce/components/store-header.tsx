import Link from "next/link";
import { BagIcon, SearchIcon, UserIcon } from "./icons";

const categories=[["Phones","phones"],["Headphones","headphones"],["Earbuds","earbuds"],["Smartwatches","smartwatches"],["Speakers","speakers"],["Keyboards","keyboards"],["Cameras","cameras"],["Chargers & power","power"]];
export function StoreHeader(){return <>
  <div className="delivery-strip"><span>Free Lagos delivery over ₦100,000</span><span>Same-day delivery in selected areas</span><Link href="/delivery">Abuja delivery from ₦150,000</Link></div>
  <header className="site-header"><div className="header-main"><Link className="wordmark" href="/" aria-label="CEDAR home">CEDAR</Link><form className="global-search" action="/search"><SearchIcon size={21}/><input name="q" placeholder="Search phones, audio, cameras and more" aria-label="Search products"/></form><nav className="header-actions" aria-label="Account and cart"><Link href="/account"><UserIcon size={25}/><span>Account</span></Link><Link href="/cart"><BagIcon size={25}/><span>Cart</span></Link></nav></div>
  <nav className="category-nav" aria-label="Product categories">{categories.map(([label,slug])=><Link key={slug} href={`/collections/${slug}`}>{label}</Link>)}<Link href="/support">Support</Link></nav></header>
  </>}
