import type { Metadata } from "next";
import { CartProvider } from "@/src/context/CartContext";
import { WishlistProvider } from "@/src/context/WishlistContext";
import { ToastProvider } from "@/src/context/ToastContext";
import "./globals.css";

export const metadata: Metadata = {
  title: "Shopora | Discover the Marketplace",
  description:
    "Explore products across categories and shop from marketplace sellers with Shopora.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      {/* suppressHydrationWarning prevents false hydration errors caused by
          browser extensions (e.g. password managers, autofill tools) that
          inject attributes like fdprocessedid into DOM elements before React
          hydrates. This only suppresses warnings on the body element itself. */}
      <body className="min-h-full flex flex-col font-sans" suppressHydrationWarning>
        <CartProvider>
          <WishlistProvider>
            <ToastProvider>{children}</ToastProvider>
          </WishlistProvider>
        </CartProvider>
      </body>
    </html>
  );
}
