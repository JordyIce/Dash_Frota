/**
 * Serverless function que faz proxy do XLSX do Google Drive.
 * Resolve CORS: navegador → vercel/api/xlsx → Google Drive
 *
 * Runtime Node (não Edge) pra ter timeout maior (60s no Hobby vs 25s no Edge).
 * Faz streaming em vez de buffer pra responder mais rápido e usar menos memória.
 */

export const config = {
  maxDuration: 60, // 60s no plano Hobby
};

export default async function handler(req: Request) {
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

    // Stream direto do Drive pro cliente (sem buffer intermediário)
    return new Response(driveRes.body, {
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
