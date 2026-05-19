import { useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Calendar, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { buildReportFilename, exportElementToPdf } from "@/lib/pdf-export";
import {
  type AccountLite,
  type UnitMode,
  fetchUnitJournalIds,
  formatRpOrDash,
} from "@/lib/account-balances";

type TabKey = "arus-kas" | "perubahan-ekuitas" | "perubahan-modal";

type LineRow = {
  journal_entry_id: string;
  account_id: string;
  debit: number | string;
  credit: number | string;
  journal_entries: { transaction_date: string; description: string | null } | null;
};

const num = (v: unknown) => (typeof v === "number" ? v : Number(v) || 0);
const isCashCode = (code: string) => code.startsWith("1.1.01") || code.startsWith("1.1.02");
const isModalCode = (code: string) => code.startsWith("3.1.") || code.startsWith("3.4.");

type Section = "OPERASI" | "INVESTASI" | "PENDANAAN";

function classifyAccount(acc: AccountLite): Section | null {
  const c = acc.code;
  const t = acc.type;
  if (isCashCode(c)) return null;
  if (c.startsWith("1.2.") || c.startsWith("1.3.")) return "INVESTASI";
  if (t === "EKUITAS" || c.startsWith("2.2.")) return "PENDANAAN";
  // sisanya (pendapatan, beban, hpp, piutang, persediaan, utang lancar, perlengkapan, dll)
  return "OPERASI";
}

async function fetchLinesInPeriod(
  start: string,
  end: string,
  mode: UnitMode,
  unitId: string | null,
): Promise<LineRow[]> {
  let entryIds: string[] | null = null;
  if (mode === "unit" && unitId) {
    entryIds = await fetchUnitJournalIds(unitId);
    if (entryIds.length === 0) return [];
  }
  const all: LineRow[] = [];
  const batches: (string[] | null)[] = entryIds
    ? Array.from({ length: Math.ceil(entryIds.length / 800) }, (_, i) =>
        entryIds!.slice(i * 800, (i + 1) * 800),
      )
    : [null];
  for (const batch of batches) {
    let q = supabase
      .from("journal_entry_lines")
      .select(
        "journal_entry_id, account_id, debit, credit, journal_entries!inner(transaction_date,description)",
      )
      .gte("journal_entries.transaction_date", start)
      .lte("journal_entries.transaction_date", end)
      .limit(50000);
    if (batch) q = q.in("journal_entry_id", batch);
    const { data, error } = await q;
    if (error) throw error;
    all.push(...((data ?? []) as unknown as LineRow[]));
  }
  return all;
}

export function FinancialFlowReports({
  title,
  subtitle,
  fixedUnitCode,
  heading,
}: {
  title: string;
  subtitle: string;
  fixedUnitCode?: string;
  heading: { line1: string; line2?: string; line3: string };
}) {
  const year = new Date().getFullYear();
  const [start, setStart] = useState(`${year}-01-01`);
  const [end, setEnd] = useState(`${year}-12-31`);
  const [tab, setTab] = useState<TabKey>("arus-kas");
  const [exporting, setExporting] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  const { data: fixedUnit } = useQuery({
    queryKey: ["unit-by-code", fixedUnitCode ?? ""],
    enabled: !!fixedUnitCode,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("units")
        .select("id,name,code")
        .eq("code", fixedUnitCode!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const mode: UnitMode = fixedUnitCode ? "unit" : "pusat";
  const unitId = fixedUnitCode ? fixedUnit?.id ?? null : null;
  const unitReady = !fixedUnitCode || !!fixedUnit;

  const { data: accounts } = useQuery({
    queryKey: ["coa_accounts", "flow-reports"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coa_accounts")
        .select("id,code,name,type,entry_type,normal_balance")
        .eq("status", "Aktif")
        .order("code")
        .limit(2000);
      if (error) throw error;
      return data as AccountLite[];
    },
  });

  // ID akun RK antar-entitas — dieliminasi dari Laporan Perubahan Ekuitas
  // saat melihat Pusat / Konsolidasi (bukan tampilan per unit).
  const { data: rkAccountIds } = useQuery({
    queryKey: ["rk-account-ids"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("entity_rk_accounts")
        .select("account_id");
      if (error) throw error;
      return new Set((data ?? []).map((r) => (r as { account_id: string }).account_id));
    },
  });
  const eliminateRk = mode !== "unit";
  const equityExcludeIds = useMemo(
    () => (eliminateRk ? rkAccountIds ?? new Set<string>() : new Set<string>()),
    [eliminateRk, rkAccountIds],
  );

  // Lines pada periode (untuk arus kas + delta ekuitas)
  const { data: linesPeriod, isLoading: lp } = useQuery({
    queryKey: ["flow-lines-period", start, end, mode, unitId],
    enabled: unitReady,
    queryFn: () => fetchLinesInPeriod(start, end, mode, unitId),
  });

  // Lines sebelum start (untuk saldo awal ekuitas/modal)
  const { data: linesOpening, isLoading: lo } = useQuery({
    queryKey: ["flow-lines-opening", start, mode, unitId],
    enabled: unitReady,
    queryFn: () => fetchLinesInPeriod("1900-01-01", addDays(start, -1), mode, unitId),
  });

  const isLoading = !accounts || lp || lo || !unitReady;

  const accById = useMemo(() => {
    const m = new Map<string, AccountLite>();
    for (const a of accounts ?? []) m.set(a.id, a);
    return m;
  }, [accounts]);

  const handleExport = async () => {
    if (!reportRef.current) return;
    try {
      setExporting(true);
      await exportElementToPdf(
        reportRef.current,
        buildReportFilename(`${title} - ${tabLabel(tab)}`, `${start}_${end}`),
      );
      toast.success("PDF berhasil diunduh");
    } catch (e) {
      toast.error("Gagal export PDF: " + (e as Error).message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <PageHeader
        title={title}
        subtitle={subtitle}
        actions={
          <>
            <div className="inline-flex items-center gap-2 rounded-lg border border-border/60 bg-secondary/60 px-3 py-2 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <input
                type="date"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                className="bg-transparent text-sm outline-none [color-scheme:dark]"
              />
              <span className="text-muted-foreground">—</span>
              <input
                type="date"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                className="bg-transparent text-sm outline-none [color-scheme:dark]"
              />
            </div>
            <button
              onClick={handleExport}
              disabled={exporting}
              className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-[var(--neon-cyan)] to-[var(--neon-green)] px-4 py-2 text-sm font-medium text-[oklch(0.15_0.03_250)] glow-cyan hover:opacity-90 transition disabled:opacity-50"
            >
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {exporting ? "Mengekspor..." : "Export PDF"}
            </button>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {(["arus-kas", "perubahan-ekuitas", "perubahan-modal"] as TabKey[]).map((k) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={cn(
              "rounded-lg px-4 py-2 text-sm font-medium transition border",
              tab === k
                ? "bg-gradient-to-r from-[var(--neon-cyan)] to-[var(--neon-green)] text-[oklch(0.15_0.03_250)] border-transparent"
                : "border-border/60 bg-secondary/40 text-muted-foreground hover:text-foreground",
            )}
          >
            {tabLabel(k)}
          </button>
        ))}
      </div>

      <div className="glass-card rounded-2xl p-3 sm:p-5">
        <div ref={reportRef} className="overflow-x-auto rounded-xl border border-slate-200 bg-white text-slate-900 shadow-md ring-1 ring-slate-100">
          <div className="min-w-[640px] p-4 sm:p-6 font-sans text-[13px]">
            <div className="text-center mb-4 leading-tight">
              <p className="text-[12px] uppercase tracking-wider text-slate-500">{heading.line1}</p>
              {heading.line2 && <p className="text-[14px] font-bold text-slate-900">{heading.line2}</p>}
              <p className="text-[13px] font-bold text-slate-900">{tabLabel(tab).toUpperCase()}</p>
              <p className="text-[11px] text-slate-500">Periode {start} s/d {end}</p>
              <p className="text-[11px] italic text-slate-500">dalam Rupiah</p>
            </div>

            {isLoading ? (
              <div className="py-12 text-center text-slate-500">
                <Loader2 className="inline h-4 w-4 animate-spin mr-2" /> Memuat data laporan...
              </div>
            ) : tab === "arus-kas" ? (
              <ArusKasTable lines={linesPeriod ?? []} accById={accById} />
            ) : (
              <EquityChangeTable
                lines={linesPeriod ?? []}
                opening={linesOpening ?? []}
                accById={accById}
                accounts={accounts ?? []}
                filter={tab === "perubahan-modal" ? "modal" : "ekuitas"}
                excludeIds={equityExcludeIds}
                eliminationNote={
                  eliminateRk && (rkAccountIds?.size ?? 0) > 0
                    ? "Akun Rekening Koran (RK) antar-entitas dieliminasi pada tampilan Pusat / Konsolidasi."
                    : null
                }
              />
            )}
          </div>
        </div>

        <p className="mt-3 text-[11px] text-muted-foreground">
          Data dihitung langsung dari journal_entry_lines tanpa mengubah logika akuntansi lain.
        </p>
      </div>
    </>
  );
}

function tabLabel(t: TabKey): string {
  if (t === "arus-kas") return "Laporan Arus Kas";
  if (t === "perubahan-ekuitas") return "Laporan Perubahan Ekuitas";
  return "Laporan Perubahan Modal";
}

function addDays(iso: string, n: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/* ---------------- Arus Kas (metode langsung) ---------------- */
function ArusKasTable({
  lines,
  accById,
}: {
  lines: LineRow[];
  accById: Map<string, AccountLite>;
}) {
  // Kumpulkan per JE: net kas, dan distribusi counter-account
  const buckets = useMemo(() => {
    const perJe = new Map<
      string,
      { cashNet: number; nonCash: { acc: AccountLite; amount: number }[] }
    >();
    for (const ln of lines) {
      const acc = accById.get(ln.account_id);
      if (!acc) continue;
      const d = num(ln.debit);
      const c = num(ln.credit);
      const cur = perJe.get(ln.journal_entry_id) ?? { cashNet: 0, nonCash: [] };
      if (isCashCode(acc.code)) {
        cur.cashNet += d - c;
      } else {
        // Tanda mengikuti sisi (debit positif untuk akun aset/beban; namun kita
        // hanya butuh besaran utk alokasi proporsional)
        cur.nonCash.push({ acc, amount: Math.abs(d - c) || d + c });
      }
      perJe.set(ln.journal_entry_id, cur);
    }
    const out: Record<Section, Map<string, number>> = {
      OPERASI: new Map(),
      INVESTASI: new Map(),
      PENDANAAN: new Map(),
    };
    for (const [, je] of perJe) {
      if (Math.abs(je.cashNet) < 0.5) continue;
      if (je.nonCash.length === 0) continue;
      const totalNon = je.nonCash.reduce((s, x) => s + x.amount, 0) || 1;
      for (const nc of je.nonCash) {
        const sec = classifyAccount(nc.acc);
        if (!sec) continue;
        const share = (nc.amount / totalNon) * je.cashNet;
        const m = out[sec];
        m.set(nc.acc.id, (m.get(nc.acc.id) ?? 0) + share);
      }
    }
    return out;
  }, [lines, accById]);

  const openingCash = 0; // saldo awal kas tidak ditampilkan agar fokus pada arus periode
  const renderSection = (sec: Section, title: string) => {
    const m = buckets[sec];
    const entries = Array.from(m.entries())
      .map(([id, v]) => ({ acc: accById.get(id)!, v }))
      .filter((x) => x.acc && Math.abs(x.v) > 0.5)
      .sort((a, b) => a.acc.code.localeCompare(b.acc.code));
    const total = entries.reduce((s, x) => s + x.v, 0);
    return { title, entries, total };
  };
  const op = renderSection("OPERASI", "ARUS KAS DARI AKTIVITAS OPERASI");
  const inv = renderSection("INVESTASI", "ARUS KAS DARI AKTIVITAS INVESTASI");
  const fin = renderSection("PENDANAAN", "ARUS KAS DARI AKTIVITAS PENDANAAN");
  const grand = op.total + inv.total + fin.total;

  return (
    <table className="w-full border-collapse text-[12px]">
      <thead>
        <tr className="border-y-2 border-slate-900 text-slate-900 font-semibold">
          <th className="text-left py-1.5 px-2">Uraian</th>
          <th className="w-40 py-1.5 text-right px-2">Jumlah (Rp)</th>
        </tr>
      </thead>
      <tbody>
        {[op, inv, fin].map((sec, i) => (
          <SectionRows key={i} title={sec.title} entries={sec.entries} total={sec.total} />
        ))}
        <tr className="border-y-2 border-slate-900 bg-slate-200">
          <td className="py-2 px-2 font-bold text-slate-900">KENAIKAN / (PENURUNAN) KAS BERSIH</td>
          <td className="py-2 px-2 text-right font-bold text-slate-900 tabular-nums">
            {formatRpOrDash(grand)}
          </td>
        </tr>
        <tr className="border-b border-slate-300">
          <td className="py-1.5 px-2 text-slate-700">Kas dan Setara Kas Awal Periode</td>
          <td className="py-1.5 px-2 text-right text-slate-700 tabular-nums">
            {formatRpOrDash(openingCash)}
          </td>
        </tr>
        <tr className="border-y-2 border-slate-900 bg-slate-100">
          <td className="py-1.5 px-2 font-bold text-slate-900">Kas dan Setara Kas Akhir Periode</td>
          <td className="py-1.5 px-2 text-right font-bold text-slate-900 tabular-nums">
            {formatRpOrDash(openingCash + grand)}
          </td>
        </tr>
      </tbody>
    </table>
  );
}

function SectionRows({
  title,
  entries,
  total,
}: {
  title: string;
  entries: { acc: AccountLite; v: number }[];
  total: number;
}) {
  return (
    <>
      <tr className="bg-slate-100">
        <td colSpan={2} className="py-1 px-2 font-bold text-slate-900">
          {title}
        </td>
      </tr>
      {entries.length === 0 ? (
        <tr>
          <td colSpan={2} className="py-2 px-4 text-slate-500 italic">
            Tidak ada aktivitas pada periode ini.
          </td>
        </tr>
      ) : (
        entries.map((e) => (
          <tr key={e.acc.id} className="border-b border-slate-200">
            <td className="py-1 px-4 text-slate-800">{e.acc.name}</td>
            <td className="py-1 px-2 text-right tabular-nums text-slate-800">
              {formatRpOrDash(e.v)}
            </td>
          </tr>
        ))
      )}
      <tr className="border-y border-slate-700 bg-slate-50">
        <td className="py-1 px-2 font-semibold text-slate-900">Jumlah Arus Kas Sub-Total</td>
        <td className="py-1 px-2 text-right font-semibold tabular-nums text-slate-900">
          {formatRpOrDash(total)}
        </td>
      </tr>
    </>
  );
}

/* ---------------- Perubahan Ekuitas / Modal ---------------- */
function EquityChangeTable({
  lines,
  opening,
  accById,
  accounts,
  filter,
  excludeIds,
  eliminationNote,
}: {
  lines: LineRow[];
  opening: LineRow[];
  accById: Map<string, AccountLite>;
  accounts: AccountLite[];
  filter: "ekuitas" | "modal";
  excludeIds?: Set<string>;
  eliminationNote?: string | null;
}) {
  const equityAccounts = useMemo(
    () =>
      accounts.filter(
        (a) =>
          a.type === "EKUITAS" &&
          a.entry_type !== "Header" &&
          !(excludeIds?.has(a.id) ?? false) &&
          (filter === "ekuitas" || isModalCode(a.code)),
      ),
    [accounts, filter, excludeIds],
  );

  const aggregate = (rows: LineRow[]) => {
    const m = new Map<string, { debit: number; credit: number }>();
    for (const ln of rows) {
      const cur = m.get(ln.account_id) ?? { debit: 0, credit: 0 };
      cur.debit += num(ln.debit);
      cur.credit += num(ln.credit);
      m.set(ln.account_id, cur);
    }
    return m;
  };
  const open = useMemo(() => aggregate(opening), [opening]);
  const period = useMemo(() => aggregate(lines), [lines]);

  const signed = (id: string, src: Map<string, { debit: number; credit: number }>) => {
    const r = src.get(id);
    if (!r) return 0;
    const acc = accById.get(id);
    const n = (acc?.normal_balance ?? "KREDIT").toUpperCase();
    return n === "DEBIT" || n === "D" ? r.debit - r.credit : r.credit - r.debit;
  };

  let totOpen = 0;
  let totAdd = 0;
  let totSub = 0;
  let totEnd = 0;

  const rows = equityAccounts.map((a) => {
    const openBal = signed(a.id, open);
    const r = period.get(a.id) ?? { debit: 0, credit: 0 };
    const n = (a.normal_balance ?? "KREDIT").toUpperCase();
    const isDebitNormal = n === "DEBIT" || n === "D";
    const additions = isDebitNormal ? r.debit : r.credit;
    const reductions = isDebitNormal ? r.credit : r.debit;
    const endBal = openBal + additions - reductions;
    if (Math.abs(openBal) < 0.5 && additions < 0.5 && reductions < 0.5 && Math.abs(endBal) < 0.5) {
      return null;
    }
    totOpen += openBal;
    totAdd += additions;
    totSub += reductions;
    totEnd += endBal;
    return (
      <tr key={a.id} className="border-b border-slate-200">
        <td className="py-1 px-2 text-slate-800">{a.name}</td>
        <td className="py-1 px-2 text-right tabular-nums">{formatRpOrDash(openBal)}</td>
        <td className="py-1 px-2 text-right tabular-nums text-emerald-700">
          {formatRpOrDash(additions)}
        </td>
        <td className="py-1 px-2 text-right tabular-nums text-rose-700">
          {formatRpOrDash(reductions)}
        </td>
        <td className="py-1 px-2 text-right tabular-nums font-medium">{formatRpOrDash(endBal)}</td>
      </tr>
    );
  });

  const filtered = rows.filter(Boolean);

  return (
    <>
      {eliminationNote && (
        <p className="mb-2 text-[11px] italic text-slate-500">{eliminationNote}</p>
      )}
      <table className="w-full border-collapse text-[12px]">
      <thead>
        <tr className="border-y-2 border-slate-900 text-slate-900 font-semibold">
          <th className="text-left py-1.5 px-2">Akun</th>
          <th className="w-32 py-1.5 text-right px-2">Saldo Awal</th>
          <th className="w-32 py-1.5 text-right px-2">Penambahan</th>
          <th className="w-32 py-1.5 text-right px-2">Pengurangan</th>
          <th className="w-32 py-1.5 text-right px-2">Saldo Akhir</th>
        </tr>
      </thead>
      <tbody>
        {filtered.length === 0 ? (
          <tr>
            <td colSpan={5} className="py-10 text-center text-slate-500">
              Belum ada pergerakan {filter === "modal" ? "modal" : "ekuitas"} pada periode ini.
            </td>
          </tr>
        ) : (
          filtered
        )}
        <tr className="border-y-2 border-slate-900 bg-slate-200">
          <td className="py-2 px-2 font-bold text-slate-900">
            TOTAL {filter === "modal" ? "MODAL" : "EKUITAS"}
          </td>
          <td className="py-2 px-2 text-right font-bold tabular-nums">{formatRpOrDash(totOpen)}</td>
          <td className="py-2 px-2 text-right font-bold tabular-nums">{formatRpOrDash(totAdd)}</td>
          <td className="py-2 px-2 text-right font-bold tabular-nums">{formatRpOrDash(totSub)}</td>
          <td className="py-2 px-2 text-right font-bold tabular-nums">{formatRpOrDash(totEnd)}</td>
        </tr>
      </tbody>
    </table>
  );
}
