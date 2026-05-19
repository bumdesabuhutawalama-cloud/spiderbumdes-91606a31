import { createFileRoute } from "@tanstack/react-router";
import { FinancialFlowReports } from "@/components/FinancialFlowReports";

export const Route = createFileRoute("/_app/laporan/arus-kas-ekuitas")({
  head: () => ({ meta: [{ title: "Arus Kas & Ekuitas Pusat · BUMDes" }] }),
  component: () => (
    <FinancialFlowReports
      title="Arus Kas, Perubahan Ekuitas & Modal"
      subtitle="Laporan tambahan dihitung otomatis dari journal entry lines."
      heading={{
        line1: "Laporan Keuangan Kantor Pusat BUM Desa",
        line2: "KANTOR PUSAT",
        line3: "ARUS KAS / EKUITAS / MODAL",
      }}
    />
  ),
});
