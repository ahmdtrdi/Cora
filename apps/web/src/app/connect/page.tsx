import type { Metadata } from "next";
import { Suspense } from "react";
import { ConnectWalletScreen } from "@/components/connect/ConnectWalletScreen";

export const metadata: Metadata = {
  title: "CORA - Connect Wallet",
  description: "Connect Phantom wallet to enter lobby and sign deposits.",
};

export default function ConnectPage() {
  return (
    <Suspense fallback={null}>
      <ConnectWalletScreen />
    </Suspense>
  );
}
