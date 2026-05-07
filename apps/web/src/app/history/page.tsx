import type { Metadata } from "next";
import { Suspense } from "react";
import { HistoryView } from "@/components/history/HistoryView";

export const metadata: Metadata = {
  title: "CORA - History",
  description: "Informational match history powered by backend GoldRush endpoints.",
};

export default function HistoryPage() {
  return (
    <Suspense fallback={null}>
      <HistoryView />
    </Suspense>
  );
}

