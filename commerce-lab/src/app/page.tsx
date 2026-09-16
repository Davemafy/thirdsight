"use client";

import { FormEvent, useMemo, useState } from "react";
import { catalog } from "@/lib/catalog";

const money = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 0,
});

export default function Storefront() {
  const [productId, setProductId] = useState(catalog[0].id);
  const [quantity, setQuantity] = useState(1);
  const [email, setEmail] = useState("demo@thirdsight.test");
  const [status, setStatus] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const product = useMemo(
    () => catalog.find((item) => item.id === productId) ?? catalog[0],
    [productId],
  );

  async function checkout(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setStatus("Creating a server-verified order…");

    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ productId, quantity, email }),
      });
      const result = await response.json();

      if (!response.ok) throw new Error(result.error ?? "Checkout failed");
      setStatus("Paystack test checkout initialized. Redirecting…");
      window.location.assign(result.authorizationUrl);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Checkout failed");
      setBusy(false);
    }
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <span className="eyebrow">THIRDSIGHT COMMERCE LAB</span>
          <h1>MarketLab</h1>
        </div>
        <div className="testBadge"><span /> TEST TRAFFIC</div>
      </header>

      <section className="hero">
        <div>
          <p className="kicker">A real integration boundary. Synthetic people.</p>
          <h2>Buy something fake.<br />Watch the access become real.</h2>
          <p className="lede">
            This storefront exists to generate genuine Paystack test traffic that ThirdSight can observe, verify and explain.
          </p>
        </div>
        <aside className="boundaryCard">
          <span>Current boundary</span>
          <strong>MarketLab → Paystack</strong>
          <p>Server-calculated amount · test key · signed webhook</p>
        </aside>
      </section>

      <section className="grid">
        <div className="products">
          {catalog.map((item) => (
            <button
              key={item.id}
              className={`productCard ${item.id === productId ? "selected" : ""}`}
              onClick={() => setProductId(item.id)}
              type="button"
            >
              <span className="productIndex">{item.code}</span>
              <div>
                <h3>{item.name}</h3>
                <p>{item.description}</p>
              </div>
              <strong>{money.format(item.priceNaira)}</strong>
            </button>
          ))}
        </div>

        <form className="checkout" onSubmit={checkout}>
          <div className="checkoutHead">
            <span>Test checkout</span>
            <strong>{money.format(product.priceNaira * quantity)}</strong>
          </div>

          <label>
            Synthetic email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>

          <label>
            Quantity
            <input
              type="number"
              min={1}
              max={5}
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              required
            />
          </label>

          <div className="evidence">
            <span>Browser sends</span>
            <code>productId · quantity · email</code>
            <span>Server owns</span>
            <code>price · amount · payment reference</code>
          </div>

          <button className="pay" type="submit" disabled={busy}>
            {busy ? "Initializing…" : "Pay with Paystack test mode"}
          </button>
          <p className="status" aria-live="polite">{status}</p>
        </form>
      </section>
    </main>
  );
}
