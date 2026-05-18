/**
 * Serverless function que faz proxy do XLSX do Google Drive.
 * Resolve CORS: navegador → vercel/api/xlsx → Google Drive
 * (Vercel é servidor, então o Drive não bloqueia o download)
 *
 * Variáveis de ambiente:
 *  VITE_XLSX_FILE_ID (mesma do front; também lida pelo backend)
 */

export default async function handler(req: Request) {
  // Permite GET com fileId via query ?id=... ou usa env var
  const url = new URL(req.url);
  const fileId =
    url.searchParams.get('id') ||
    process.env.VITE_XLSX_FILE_ID ||
    process.env.XLSX_FILE_ID ||
    '';

  if (!fileId) {
    return new Response(
      JSON.stringify({ error: 'fileId não fornecido. Defina VITE_XLSX_FILE_ID nas env vars.' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const driveUrl = `https://drive.usercontent.google.com/download?id=${fileId}&export=download&confirm=t`;

  try {
    const driveRes = await fetch(driveUrl, {
      redirect: 'follow',
      headers: {
        // Faz request "como navegador" pra evitar problemas
        'User-Agent': 'Mozilla/5.0 (compatible; DashFrota/1.0)',
      },
    });

    if (!driveRes.ok) {
      return new Response(
        JSON.stringify({
          error: `Falha ao baixar XLSX do Drive: HTTP ${driveRes.status}`,
          hint: 'Verifique se o arquivo é público (Qualquer pessoa com link).',
        }),
        { status: driveRes.status, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const buffer = await driveRes.arrayBuffer();

    // Devolve o XLSX binário com cache curto (5min) pra reduzir carga
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
    return new Response(
      JSON.stringify({ error: `Erro no proxy: ${msg}` }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
}
