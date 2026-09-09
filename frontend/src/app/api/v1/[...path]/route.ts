import { NextRequest, NextResponse } from "next/server";

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

type ProxyInit = RequestInit & { duplex?: "half" };

const HOP_BY_HOP = new Set([
  "connection",
  "content-encoding",
  "content-length",
  "host",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailers",
  "transfer-encoding",
  "upgrade",
]);

function backendOrigin(): string {
  return (process.env.BACKEND_URL ?? "http://localhost:8000").replace(/\/$/, "");
}

function copyHeaders(source: Headers, skip: ReadonlySet<string>): Headers {
  const headers = new Headers();
  source.forEach((value, key) => {
    if (!skip.has(key.toLowerCase())) {
      headers.append(key, value);
    }
  });
  return headers;
}

async function proxyToBackend(
  request: NextRequest,
  context: RouteContext,
): Promise<Response> {
  const { path } = await context.params;
  const suffix = path.filter(Boolean).join("/").replace(/\/+$/, "");
  const target = `${backendOrigin()}/api/v1/${suffix}${request.nextUrl.search}`;
  const init: ProxyInit = {
    method: request.method,
    headers: copyHeaders(request.headers, HOP_BY_HOP),
    redirect: "manual",
    cache: "no-store",
  };
  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = request.body;
    init.duplex = "half";
  }

  const upstream = await fetch(target, init);
  const headers = copyHeaders(upstream.headers, HOP_BY_HOP);
  return new NextResponse(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers,
  });
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const GET = proxyToBackend;
export const POST = proxyToBackend;
export const PUT = proxyToBackend;
export const PATCH = proxyToBackend;
export const DELETE = proxyToBackend;
export const HEAD = proxyToBackend;
export const OPTIONS = proxyToBackend;
