"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Upload, X } from "lucide-react";
import { detectHeaderRow, downloadTemplate } from "@/lib/import-utils";

type Company = "1001" | "maison_y";
type Sheet = { name: string; rows: string[][] };
type Row = { deskripsi_coa: string; department: string; periode: string; anggaran: number; aktual: number };
type ApiRow = Record<string, unknown>;

type Pair = { department: string; budgetIndex: number; actualIndex: number };

const periods = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
const departments = ["DEVELOPMENT","FAT","HRD","MANAGEMENT KIKI","MANAGEMENT UMA","MARKETING","MERCHANDISE","OPERASIONAL","PURCHASING","WAREHOUSE"];
const nf = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 });
const pf = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 });

function n(v: unknown) {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  let s = String(v ?? "").trim().replace(/^rp\s*/i, "").replace(/%/g, "").replace(/\s/g, "");
  if (!s || s === "-") return 0;
  const neg = /^\(.*\)$/.test(s);
  s = s.replace(/^\(|\)$/g, "");
  if (/^[-+]?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replaceAll(".", "").replace(",", ".");
  else if (/^[-+]?\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replaceAll(",", "");
  const x = Number(s);
  return Number.isFinite(x) ? (neg ? -Math.abs(x) : x) : 0;
}

function norm(v: unknown) { return String(v ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, ""); }
function dept(v: unknown) { return String(v ?? "").trim().replace(/\s+/g, " ").toUpperCase(); }
function period(v: unknown) {
  const s = String(v ?? "").trim().toLowerCase();
  const map: Record<string,string> = {jan:"Januari",januari:"Januari",feb:"Februari",februari:"Februari",mar:"Maret",maret:"Maret",apr:"April",april:"April",mei:"Mei",jun:"Juni",juni:"Juni",jul:"Juli",juli:"Juli",agu:"Agustus",agustus:"Agustus",sep:"September",september:"September",okt:"Oktober",oktober:"Oktober",nov:"November",november:"November",des:"Desember",desember:"Desember"};
  if (map[s]) return map[s];
  for (const [k,val] of Object.entries(map)) if (s.includes(k)) return val;
  return String(v ?? "").trim() || "Semua Periode";
}

function pairs(headers: string[]): Pair[] {
  const found = new Map<string,{b?:number;a?:number}>();
  headers.map(norm).forEach((h,i) => {
    const b = h.match(/^(.*)_(anggaran|budget)$/), a = h.match(/^(.*)_(aktual|actual)$/);
    if (b?.[1]) { const d = dept(b[1].replace(/_/g," ")); const cur = found.get(d) ?? {}; cur.b=i; found.set(d,cur); }
    if (a?.[1]) { const d = dept(a[1].replace(/_/g," ")); const cur = found.get(d) ?? {}; cur.a=i; found.set(d,cur); }
  });
  return Array.from(found.entries()).filter(([,x]) => x.b !== undefined && x.a !== undefined).map(([department,x]) => ({department,budgetIndex:x.b as number,actualIndex:x.a as number}));
}

function parseSheet(sheet: Sheet): Row[] {
  const headerRow = detectHeaderRow(sheet.rows);
  const headers = (sheet.rows[headerRow] ?? []).map(String);
  const nh = headers.map(norm);
  const coa = nh.findIndex(x => x.includes("deskripsi") || x.includes("coa") || x === "description");
  if (coa < 0) return [];
  const pIndex = nh.findIndex(x => ["periode","bulan","month","period"].includes(x));
  const dIndex = nh.findIndex(x => ["department","departemen","dept"].includes(x));
  const bIndex = nh.findIndex(x => ["anggaran","budget"].includes(x));
  const aIndex = nh.findIndex(x => ["aktual","actual"].includes(x));
  const ps = pairs(headers);
  const fallback = period(sheet.name);
  const out: Row[] = [];
  sheet.rows.slice(headerRow+1).forEach(r => {
    const c = String(r[coa] ?? "").trim(); if (!c) return;
    const pr = period(pIndex >= 0 ? r[pIndex] : fallback);
    if (dIndex >= 0 && bIndex >= 0 && aIndex >= 0) {
      const d = dept(r[dIndex]); if (d) out.push({deskripsi_coa:c,department:d,periode:pr,anggaran:n(r[bIndex]),aktual:n(r[aIndex])});
    }
    ps.forEach(x => out.push({deskripsi_coa:c,department:x.department,periode:pr,anggaran:n(r[x.budgetIndex]),aktual:n(r[x.actualIndex])}));
  });
  return out;
}

function fromApi(v: unknown): Row | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const r = v as ApiRow;
  const c = String(r.deskripsi_coa ?? r.deskripsi ?? r.description ?? "").trim();
  const d = dept(r.department ?? r.departemen ?? "");
  if (!c || !d) return null;
  return {deskripsi_coa:c,department:d,periode:period(r.periode ?? r.bulan ?? r.month ?? ""),anggaran:n(r.anggaran ?? r.budget),aktual:n(r.aktual ?? r.actual)};
}

function money(v:number){ const a=Math.abs(v); if(a>=1e9)return `Rp${pf.format(v/1e9)} M`; if(a>=1e6)return `Rp${pf.format(v/1e6)} jt`; return `Rp${nf.format(v)}`; }

function UploadModal({company,onClose,onDone}:{company:Company;onClose:()=>void;onDone:()=>void}){
  const ref=useRef<HTMLInputElement>(null); const [file,setFile]=useState<File|null>(null); const [sheets,setSheets]=useState<Sheet[]>([]); const [busy,setBusy]=useState(""); const [error,setError]=useState("");
  const parsed=useMemo(()=>sheets.flatMap(parseSheet),[sheets]);
  async function choose(f?:File){ if(!f)return; setFile(f); setBusy("Membaca file Excel..."); setError(""); try{ const fd=new FormData();fd.append("file",f);const res=await fetch("/api/upload/preview",{method:"POST",body:fd});const data=await res.json();if(!res.ok||!Array.isArray(data.sheets))throw new Error(data.error||"File gagal dibaca.");setSheets(data.sheets);}catch(e){setError(e instanceof Error?e.message:"File gagal dibaca.");}finally{setBusy("");}}
  async function save(strategy:"cancel"|"replace"="cancel"){ if(!file||!parsed.length)return;setBusy("Menyimpan data...");setError("");try{const res=await fetch("/api/report-import",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({company,reportType:"sisa_budget_detail_biaya",fileName:file.name,sheetName:sheets.length>1?"Semua Sheet":sheets[0]?.name??"Sheet1",headers:["periode","deskripsi_coa","department","anggaran","aktual"],rows:parsed,strategy})});const d=await res.json().catch(()=>({}));if(res.status===409&&strategy==="cancel"){if(confirm("Data sudah ada. Ganti dengan data terbaru?"))await save("replace");return;}if(!res.ok)throw new Error(d.error||"Gagal menyimpan data.");onDone();onClose();}catch(e){setError(e instanceof Error?e.message:"Gagal menyimpan data.");}finally{setBusy("");}}
  return <div className="fixed inset-0 z-[110] overflow-y-auto bg-black/80 p-4 md:p-10"><div className="mx-auto max-w-6xl rounded-2xl border border-gold-500/20 bg-zinc-950 p-5"><div className="mb-5 flex items-center justify-between"><div><h2 className="text-xl font-semibold">Upload Laporan Sisa Budget Per Detail Biaya</h2><p className="text-sm text-zinc-400">Satu file bisa berisi semua departemen.</p></div><button onClick={onClose}><X/></button></div><div className="grid gap-3 md:grid-cols-2"><button className="secondary-button" onClick={()=>downloadTemplate("sisa_budget_detail_biaya")}>Download Template</button><button className="gold-button" onClick={()=>ref.current?.click()}>Pilih File Excel</button><input ref={ref} hidden type="file" accept=".xlsx,.xls,.csv" onChange={e=>choose(e.target.files?.[0])}/></div>{busy&&<p className="mt-4 text-gold-300">{busy}</p>}{error&&<div className="error mt-4">{error}</div>}{sheets.length>0&&<div className="mt-5"><p className="mb-4 text-sm">{parsed.length} baris terbaca dari {new Set(parsed.map(x=>x.department)).size} departemen.</p><button disabled={!parsed.length||!!busy} className="gold-button disabled:opacity-40" onClick={()=>save()}>Import & Simpan Semua Departemen</button></div>}</div></div>;
}

export default function SisaBudgetDetailEnhancer(){
  const [host,setHost]=useState<HTMLElement|null>(null); const [company,setCompany]=useState<Company>("1001"); const [rows,setRows]=useState<Row[]>([]); const [modal,setModal]=useState(false); const [fPeriod,setFPeriod]=useState("all"); const [fDept,setFDept]=useState("all"); const [fCoa,setFCoa]=useState("all"); const [fStatus,setFStatus]=useState("all");
  const active=typeof window!=="undefined"&&window.location.pathname==="/laporan-budget"&&new URLSearchParams(window.location.search).get("view")==="sisa-budget-detail-biaya";
  const syncCompany=useCallback(()=>setCompany(localStorage.getItem("budgeting_active_company")==="maison_y"?"maison_y":"1001"),[]);
  const load=useCallback(async()=>{try{const res=await fetch(`/api/reports?reportType=sisa_budget_detail_biaya&company=${company}`,{cache:"no-store"});const d:unknown=await res.json();setRows(res.ok&&Array.isArray(d)?d.map(fromApi).filter((x):x is Row=>x!==null):[]);}catch{setRows([]);}},[company]);
  useEffect(()=>{if(!active)return;syncCompany();const main=document.querySelector("main");const content=main?.children.item(1) as HTMLElement|null;if(content){content.classList.add("sisa-detail-host");setHost(content);}const title=main?.querySelector("header h1");const old=title?.textContent??"";if(title)title.textContent="Laporan Sisa Budget Per Detail Biaya";const click=()=>setTimeout(syncCompany,0);document.addEventListener("click",click);return()=>{document.removeEventListener("click",click);content?.classList.remove("sisa-detail-host");if(title)title.textContent=old;};},[active,syncCompany]);
  useEffect(()=>{if(active)void load();},[active,load]);
  const coa=useMemo(()=>Array.from(new Set(rows.map(r=>r.deskripsi_coa))).sort(),[rows]);
  const filtered=useMemo(()=>rows.filter(r=>{if(fPeriod!=="all"&&r.periode!==fPeriod)return false;if(fDept!=="all"&&r.department!==fDept)return false;if(fCoa!=="all"&&r.deskripsi_coa!==fCoa)return false;const over=r.aktual>r.anggaran;if(fStatus==="over"&&!over)return false;if(fStatus==="under"&&over)return false;return true;}),[rows,fPeriod,fDept,fCoa,fStatus]);
  const sum=useMemo(()=>{const budget=filtered.reduce((s,r)=>s+r.anggaran,0),actual=filtered.reduce((s,r)=>s+r.aktual,0),sisa=Math.max(budget-actual,0),over=Math.max(actual-budget,0);return{budget,actual,sisa,over};},[filtered]);
  if(!active||!host)return null;
  const chart=sum.over>0?[{name:"Budget",value:sum.budget},{name:"Over Budget",value:sum.over}]:[{name:"Aktual",value:sum.actual},{name:"Sisa",value:sum.sisa}].filter(x=>x.value>0);
  const grouped=Array.from(filtered.reduce((m,r)=>{const a=m.get(r.department)??[];a.push(r);m.set(r.department,a);return m;},new Map<string,Row[]>()).entries());
  return createPortal(<div className="sisa-detail-root space-y-6"><style>{`.sisa-detail-host > :not(.sisa-detail-root){display:none!important}`}</style><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-semibold">Laporan Sisa Budget Per Detail Biaya</h2><p className="text-sm text-zinc-400">Tampilan, filter, pie chart dan upload mengikuti Laporan Per Detail Biaya.</p></div><div className="flex gap-2"><button className="secondary-button" onClick={()=>downloadTemplate("sisa_budget_detail_biaya")}>Download Template</button><button className="gold-button flex items-center gap-2" onClick={()=>setModal(true)}><Upload className="h-4 w-4"/> Upload Excel</button></div></div><section className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4"><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4"><select className="input" value={fPeriod} onChange={e=>setFPeriod(e.target.value)}><option value="all">Semua Periode</option>{periods.map(x=><option key={x}>{x}</option>)}</select><select className="input" value={fDept} onChange={e=>setFDept(e.target.value)}><option value="all">Semua Departemen</option>{departments.map(x=><option key={x}>{x}</option>)}</select><select className="input" value={fCoa} onChange={e=>setFCoa(e.target.value)}><option value="all">Semua Deskripsi COA</option>{coa.map(x=><option key={x}>{x}</option>)}</select><select className="input" value={fStatus} onChange={e=>setFStatus(e.target.value)}><option value="all">Semua Status</option><option value="over">Over Budget</option><option value="under">Under Budget</option></select></div></section><section className="rounded-2xl border border-gold-500/20 bg-zinc-950/80 p-5"><h2 className="text-lg font-semibold">Sisa Budget · {fDept==="all"?"Semua Departemen":fDept}</h2><p className="text-xs text-zinc-400">Grafik mengikuti pilihan filter di atas</p>{chart.length?<div className="grid items-center gap-6 lg:grid-cols-[420px_1fr]"><div className="h-72"><ResponsiveContainer><PieChart><Pie data={chart} dataKey="value" nameKey="name" outerRadius={105} stroke="none">{chart.map((x,i)=><Cell key={x.name} fill={i===0?"#f05a3a":sum.over>0?"#dc2626":"#2a9d8f"}/>)}</Pie><Tooltip formatter={(v:number|string)=>money(Number(v))}/></PieChart></ResponsiveContainer></div><div><p className="text-zinc-400">Aktual</p><p className="text-2xl font-semibold">{money(sum.actual)}</p><p className="mt-4 text-zinc-400">{sum.over>0?"Over Budget":"Sisa"}</p><p className="text-2xl font-semibold">{money(sum.over>0?sum.over:sum.sisa)}</p><p className="mt-4 text-zinc-400">Total Budget</p><p className="text-xl font-semibold">{money(sum.budget)}</p></div></div>:<p className="py-12 text-center text-zinc-500">Belum ada data sesuai filter.</p>}</section>{grouped.map(([d,rs])=><div key={d} className="overflow-x-auto rounded-2xl border border-gold-500/20"><table className="w-full min-w-[900px] text-sm"><thead className="bg-blue-900 text-white"><tr><th className="px-4 py-3 text-left">Deskripsi COA</th><th className="px-4 py-3 text-right">{d} - Anggaran</th><th className="px-4 py-3 text-right">{d} - Aktual</th><th className="px-4 py-3 text-right">Sisa Budget</th><th className="px-4 py-3">Status Budget</th></tr></thead><tbody>{rs.map((r,i)=>{const s=r.anggaran-r.aktual,over=s<0;return <tr key={`${r.deskripsi_coa}-${i}`} className="border-b border-zinc-800"><td className="px-4 py-3">{r.deskripsi_coa}</td><td className="px-4 py-3 text-right">{nf.format(r.anggaran)}</td><td className="px-4 py-3 text-right">{nf.format(r.aktual)}</td><td className="px-4 py-3 text-right">{nf.format(s)}</td><td className={over?"px-4 py-3 text-red-400":"px-4 py-3 text-emerald-400"}>{over?"Over Budget":"Under Budget"}</td></tr>})}</tbody></table></div>)}{modal&&<UploadModal company={company} onClose={()=>setModal(false)} onDone={()=>void load()}/>}</div>,host);
}
