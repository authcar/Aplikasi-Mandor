import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";

// Lindungi rute /mandor dan /supervisor: wajib login + role sesuai.
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

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;

  if (!user && (path.startsWith("/mandor") || path.startsWith("/supervisor"))) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (user && (path.startsWith("/mandor") || path.startsWith("/supervisor"))) {
    const { data: p } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    const role = p?.role;
    if (path.startsWith("/mandor") && role !== "MANDOR")
      return NextResponse.redirect(new URL("/supervisor", request.url));
    if (path.startsWith("/supervisor") && role !== "SUPERVISOR")
      return NextResponse.redirect(new URL("/mandor", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/mandor/:path*", "/supervisor/:path*"],
};
