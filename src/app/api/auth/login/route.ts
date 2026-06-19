import { NextRequest, NextResponse } from "next/server";
import * as bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { encode } from "next-auth/jwt";

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Email dan password wajib diisi." }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email: String(email).toLowerCase().trim() },
    });

    if (!user || !user.isActive) {
      return NextResponse.json({ error: "Email atau password salah." }, { status: 401 });
    }

    const isValid = await bcrypt.compare(String(password), user.passwordHash);
    if (!isValid) {
      return NextResponse.json({ error: "Email atau password salah." }, { status: 401 });
    }

    const secret = process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET ?? "dev-secret-nova";

    const secureCookie = process.env.NEXTAUTH_URL?.startsWith("https");
    const cookieName = secureCookie
      ? "__Secure-authjs.session-token"
      : "authjs.session-token";

    const token = await encode({
      token: {
        sub: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      secret,
      salt: cookieName,
      maxAge: 60 * 60 * 8,
    });

    const response = NextResponse.json({ ok: true, user: { name: user.name, role: user.role } });

    response.cookies.set(cookieName, token, {
      httpOnly: true,
      secure: Boolean(secureCookie),
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 8,
    });

    return response;
  } catch (error) {
    console.error("[login]", error);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
