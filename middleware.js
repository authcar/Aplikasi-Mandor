import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";

const ROLE_HOME = { MANDOR: "/mandor", SUPERVISOR: "/supervisor", MASTER: "/master", FINANCE: "/finance", TUKANG_HARIAN: "/tukang-harian" };

export async function middleware(request) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list) => {
          list.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          list.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;

  const isProtected =
    path.startsWith("/mandor") ||
    path.startsWith("/supervisor") ||
    path.startsWith("/master") ||
    path.startsWith("/finance") ||
    path.startsWith("/tukang-harian");

  if (!user && isProtected) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (user && isProtected) {
    const { data: p } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    const role = p?.role;
    const home = ROLE_HOME[role] || "/login";

    if (path.startsWith("/mandor") && role !== "MANDOR")
      return NextResponse.redirect(new URL(home, request.url));
    if (path.startsWith("/supervisor") && role !== "SUPERVISOR")
      return NextResponse.redirect(new URL(home, request.url));
    if (path.startsWith("/master") && role !== "MASTER")
      return NextResponse.redirect(new URL(home, request.url));
    if (path.startsWith("/finance") && role !== "FINANCE")
      return NextResponse.redirect(new URL(home, request.url));
    if (path.startsWith("/tukang-harian") && role !== "TUKANG_HARIAN")
      return NextResponse.redirect(new URL(home, request.url));
  }

  return response;
}

export const config = {
  matcher: ["/mandor/:path*", "/supervisor/:path*", "/master/:path*", "/finance/:path*", "/tukang-harian/:path*"],
};
