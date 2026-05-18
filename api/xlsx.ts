/**
 * Serverless function que faz proxy do XLSX do Google Drive.
 * Resolve CORS: navegador → vercel/api/xlsx → Google Drive
 */

export const config = {
  maxDuration: 60,
};

export default async function handler(req: Request) {
  // req.url pode vir relativo ("/api/xlsx?id=...") em Node runtime,
  // então normaliza pra URL absoluta antes de parsear
  const fullUrl = req.url.startsWith('http')
    ? req.url
    : `http://localhost${req.url}`;
  const url = new URL(fullUrl);

  const fileId =
    url.searchParams.get('id') ||
    process.env.VITE_XLSX_FILE_ID ||
    process.env.XLSX_FILE_ID ||
    '';

  console.log('[xlsx-proxy] fileId:', fileId);

  if (!fileId) {
    return new Response(
      JSON.stringify({ error: 'fileId não fornecido. Defina VITE_XLSX_FILE_ID nas env vars.' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const driveUrl = `https://drive.usercontent.google.com/download?id=${fileId}&export=download&confirm=t`;
  console.log('[xlsx-proxy] Buscando:', driveUrl);

  try {
    const driveRes = await fetch(driveUrl, {
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    console.log('[xlsx-proxy] Drive respondeu:', driveRes.status, driveRes.statusText);
    console.log('[xlsx-proxy] Content-Type:', driveRes.headers.get('content-type'));
    console.log('[xlsx-proxy] Content-Length:', driveRes.headers.get('content-length'));

    if (!driveRes.ok) {
      const text = await driveRes.text();
      console.log('[xlsx-proxy] Body do erro:', text.substring(0, 500));
      return new Response(
        JSON.stringify({
          error: `Drive retornou HTTP ${driveRes.status}`,
          contentType: driveRes.headers.get('content-type'),
          preview: text.substring(0, 200),
        }),
        { status: driveRes.status, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const buffer = await driveRes.arrayBuffer();
    console.log('[xlsx-proxy] Baixado:', buffer.byteLength, 'bytes');

    // Magic number: XLSX é ZIP, começa com "PK"
    const bytes = new Uint8Array(buffer.slice(0, 4));
    const isPK = bytes[0] === 0x50 && bytes[1] === 0x4b;
    console.log('[xlsx-proxy] É XLSX (PK)?', isPK);

    if (!isPK) {
      const text = new TextDecoder().decode(buffer.slice(0, 500));
      console.log('[xlsx-proxy] Preview:', text);
      return new Response(
        JSON.stringify({
          error: 'Drive devolveu HTML em vez do XLSX',
          preview: text.substring(0, 300),
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } },
      );
    }

    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Cache-Control': 's-maxage=300, stale-while-revalidate=60',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const stack = e instanceof Error ? e.stack : undefined;
    console.error('[xlsx-proxy] ERRO:', msg);
    console.error('[xlsx-proxy] Stack:', stack);
    return new Response(
      JSON.stringify({ error: `Erro no proxy: ${msg}`, stack: stack?.substring(0, 500) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
}
