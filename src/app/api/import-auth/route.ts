import { NextResponse } from "next/server";
import {
  IMPORT_AUTH_COOKIE,
  importSessionToken,
  verifyImportPassword,
} from "@/lib/import-auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const password = String(body?.password ?? "");

    if (!verifyImportPassword(password)) {
      return NextResponse.json(
        { authorized: false, error: "Password salah." },
        { status: 401 },
      );
    }

    const response = NextResponse.json({ authorized: true });
    response.cookies.set(IMPORT_AUTH_COOKIE, importSessionToken(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 8,
    });
    return response;
  } catch {
    return NextResponse.json(
      { authorized: false, error: "Password tidak valid." },
      { status: 400 },
    );
  }
}

export async function DELETE() {
  const response = NextResponse.json({ authorized: false });
  response.cookies.set(IMPORT_AUTH_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
