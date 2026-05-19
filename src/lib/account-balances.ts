import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type AccountLite = {
  id: string;
  code: string;
  name: string;
  type: string;
  entry_type: string;
  normal_balance?: string;
};

export type Balance = { debit: number; credit: number; balance: number };

export type BalanceMap = Map<string, Balance>;

type LineRow = {
  account_id: string;
  debit: number | string;
  credit: number | string;
  journal_entries: { transaction_date: string } | { transaction_date: string }[] | null;
};

const num = (v: unknown) => (typeof v === "number" ? v : Number(v) || 0);

const normalOf = (typeOrNormal: string): "D" | "K" => {
  const s = (typeOrNormal || "").toUpperCase();
  if (s === "DEBIT" || s === "D") return "D";
  if (s === "KREDIT" || s === "CREDIT" || s === "K") return "K";
  if (s === "ASET" || s === "BEBAN") return "D";
  return "K";
};

export type UnitMode = "pusat" | "unit" | "konsolidasi";

/**
 * Baca saldo LANGSUNG dari journal_entry_lines (sumber kebenaran).
 * Filter berdasar transaction_date (bukan period bulanan) supaya akurat
 * sampai tanggal tertentu. Tabel `account_balances` tidak digunakan karena
 * pernah mengalami drift; jurnal adalah satu-satunya truth source.
 */
export async function fetchUnitJournalIds(unitId: string): Promise<string[]> {
  // Akun "milik" unit: kas_account_id pada units + akun RK yang owner-nya unit ini.
  const [{ data: unit }, { data: rk }, { data: faHist }] = await Promise.all([
    supabase.from("units").select("kas_account_id,code").eq("id", unitId).maybeSingle(),
    supabase.from("entity_rk_accounts").select("account_id").eq("owner_entity_id", unitId),
    // Jurnal penyusutan tidak menyentuh kas unit; ambil via fixed_assets→history.
    supabase
      .from("fixed_asset_depreciation_history" as never)
      .select("journal_id, fixed_assets!inner(unit_id)")
      .eq("fixed_assets.unit_id", unitId)
      .limit(50000),
  ]);
  const ids = new Set<string>();
  const ownedIds = new Set<string>();
  if (unit?.kas_account_id) ownedIds.add(unit.kas_account_id as string);
  for (const r of rk ?? []) ownedIds.add((r as { account_id: string }).account_id);
  for (const h of (faHist ?? []) as unknown as { journal_id: string | null }[]) {
    if (h.journal_id) ids.add(h.journal_id);
  }
  // Jurnal yang transaction_type-nya diawali kode unit (mis. DAGANG_*, USP_*)
  // ikut diklaim sebagai aktivitas unit walau tidak menyentuh kas unit
  // (mis. penjualan kredit: Dr Piutang / Cr Pendapatan / Dr HPP / Cr Persediaan).
  const unitCode = (unit as { code?: string } | null)?.code;
  if (unitCode) {
    const { data: typedJe } = await supabase
      .from("journal_entries")
      .select("id")
      .like("transaction_type", `${unitCode}_%`)
      .limit(50000);
    for (const j of typedJe ?? []) ids.add((j as { id: string }).id);
  }
  if (ownedIds.size > 0) {
    // Jurnal yang menyentuh salah satu akun milik unit → seluruh sisi jurnal itu
    // ikut dihitung sebagai aktivitas unit (menjaga keseimbangan double-entry).
    const { data: lines } = await supabase
      .from("journal_entry_lines")
      .select("journal_entry_id")
      .in("account_id", Array.from(ownedIds))
      .limit(50000);
    for (const l of lines ?? []) ids.add((l as { journal_entry_id: string }).journal_entry_id);
  }
  return Array.from(ids);
}

async function fetchBalances(
  startDate?: string,
  endDate?: string,
  mode: UnitMode = "pusat",
  unitId?: string | null,
): Promise<LineRow[]> {
  let entryIds: string[] | null = null;
  if (mode === "unit" && unitId) {
    entryIds = await fetchUnitJournalIds(unitId);
    if (entryIds.length === 0) return [];
  }

  // Supabase membatasi ~1000 item per filter `in`. Pecah menjadi batch.
  const all: LineRow[] = [];
  const batches: (string[] | null)[] = entryIds
    ? Array.from({ length: Math.ceil(entryIds.length / 800) }, (_, i) =>
        entryIds!.slice(i * 800, (i + 1) * 800),
      )
    : [null];

  for (const batch of batches) {
    let q = supabase
      .from("journal_entry_lines")
      .select("account_id, debit, credit, journal_entries!inner(transaction_date)")
      .limit(50000);
    if (startDate) q = q.gte("journal_entries.transaction_date", startDate);
    if (endDate) q = q.lte("journal_entries.transaction_date", endDate);
    if (batch) q = q.in("journal_entry_id", batch);
    const { data, error } = await q;
    if (error) throw error;
    all.push(...((data ?? []) as unknown as LineRow[]));
  }
  return all;
}

function reduceRows(rows: LineRow[]): BalanceMap {
  const map: BalanceMap = new Map();
  for (const r of rows) {
    const cur = map.get(r.account_id) ?? { debit: 0, credit: 0, balance: 0 };
    cur.debit += num(r.debit);
    cur.credit += num(r.credit);
    map.set(r.account_id, cur);
  }
  return map;
}

/** Saldo akumulasi sejak awal hingga `asOfDate` (untuk Neraca). */
export function useAccountBalances(
  asOfDate?: string,
  mode: UnitMode = "pusat",
  unitId?: string | null,
) {
  return useQuery({
    queryKey: ["balances", "asof", asOfDate ?? "all", mode, unitId ?? ""],
    queryFn: async () => reduceRows(await fetchBalances(undefined, asOfDate, mode, unitId)),
  });
}

/** Saldo dalam rentang tanggal (untuk Laba Rugi). */
export function useAccountBalancesPeriod(
  start?: string,
  end?: string,
  mode: UnitMode = "pusat",
  unitId?: string | null,
) {
  return useQuery({
    queryKey: ["balances", "period", start ?? "", end ?? "", mode, unitId ?? ""],
    queryFn: async () => reduceRows(await fetchBalances(start, end, mode, unitId)),
  });
}

/** Sisi normal natural berdasar tipe akun (untuk deteksi akun kontra). */
const naturalSideOfType = (type: string): "D" | "K" => {
  const t = (type || "").toUpperCase();
  if (t === "ASET" || t === "BEBAN") return "D";
  return "K"; // KEWAJIBAN, EKUITAS, PENDAPATAN
};

/**
 * Hitung saldo per akun (sesuai normal_balance), lalu rollup ke akun Header
 * berdasarkan prefix kode. Akun kontra (normal_balance berlawanan dengan
 * sisi natural tipe akun) akan dikurangkan dari total parent.
 */
export function computeSignedBalances(
  accounts: AccountLite[],
  raw: BalanceMap,
): Map<string, number> {
  const out = new Map<string, number>();
  // Detail accounts: ending_balance per kaidah normal_balance
  for (const a of accounts) {
    const r = raw.get(a.id);
    if (!r) {
      out.set(a.id, 0);
      continue;
    }
    const n = normalOf(a.normal_balance ?? a.type);
    out.set(a.id, n === "D" ? r.debit - r.credit : r.credit - r.debit);
  }
  // Rollup header: jumlahkan semua detail descendants berdasarkan prefix kode.
  // Akun kontra (sisi normal berlawanan dengan tipe induknya) dikurangkan.
  for (const h of accounts) {
    if (h.entry_type !== "Header") continue;
    let sum = 0;
    const prefix = h.code + ".";
    const naturalParent = naturalSideOfType(h.type);
    for (const a of accounts) {
      if (a.id === h.id || a.entry_type === "Header") continue;
      if (!a.code.startsWith(prefix)) continue;
      const child = out.get(a.id) ?? 0;
      const isContra = normalOf(a.normal_balance ?? a.type) !== naturalParent;
      sum += isContra ? -child : child;
    }
    out.set(h.id, sum);
  }
  return out;
}

/**
 * Tentukan akun mana yang "aktif" (punya aktivitas / saldo non-nol) pada
 * salah satu set saldo yang diberikan. Header dianggap aktif jika ada
 * descendant (berdasar prefix kode) yang aktif. Ambang threshold 0.5
 * mengikuti pembulatan tampilan.
 */
export function computeActiveAccountIds(
  accounts: AccountLite[],
  rawMaps: BalanceMap[],
  signedMaps: Map<string, number>[],
): Set<string> {
  const active = new Set<string>();
  for (const a of accounts) {
    if (a.entry_type === "Header") continue;
    let isActive = false;
    for (const r of rawMaps) {
      const b = r.get(a.id);
      if (b && (b.debit > 0.5 || b.credit > 0.5)) {
        isActive = true;
        break;
      }
    }
    if (!isActive) {
      for (const s of signedMaps) {
        if (Math.abs(s.get(a.id) ?? 0) > 0.5) {
          isActive = true;
          break;
        }
      }
    }
    if (isActive) active.add(a.id);
  }
  // Headers: aktif jika ada detail descendant aktif
  for (const h of accounts) {
    if (h.entry_type !== "Header") continue;
    const prefix = h.code + ".";
    for (const a of accounts) {
      if (a.id === h.id || a.entry_type === "Header") continue;
      if (!a.code.startsWith(prefix)) continue;
      if (active.has(a.id)) {
        active.add(h.id);
        break;
      }
    }
  }
  return active;
}

/** Total saldo untuk akun-akun dengan tipe tertentu (akun kontra dikurangkan). */
export function sumByType(
  accounts: AccountLite[],
  signed: Map<string, number>,
  types: string[],
): number {
  let s = 0;
  for (const a of accounts) {
    if (a.entry_type === "Header") continue;
    if (!types.includes(a.type)) continue;
    const natural = naturalSideOfType(a.type);
    const isContra = normalOf(a.normal_balance ?? a.type) !== natural;
    const v = signed.get(a.id) ?? 0;
    s += isContra ? -v : v;
  }
  return s;
}

export const formatRp = (n: number) =>
  new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(Math.round(n));

export const formatRpOrDash = (n: number) => (Math.abs(n) < 0.5 ? "-" : formatRp(n));
