import { execute, query, quote } from '@/lib/db'; import { NextResponse } from 'next/server';
export const runtime='nodejs';
export async function GET(){try{return NextResponse.json(query('SELECT * FROM budget_requests ORDER BY id DESC'))}catch(e){return NextResponse.json({error:String(e)},{status:500})}}
export async function POST(req:Request){try{const r=await req.json();execute(`INSERT INTO budget_requests(request_date,department,category,amount,description,pic,status) VALUES(${quote(r.request_date)},${quote(r.department)},${quote(r.category)},${Number(r.amount)},${quote(r.description)},${quote(r.pic)},${quote(r.status)})`);return NextResponse.json({ok:true})}catch(e){return NextResponse.json({error:String(e)},{status:500})}}
