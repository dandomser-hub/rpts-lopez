Deno.serve((_req: Request) => new Response(
  JSON.stringify({ error: "Legacy taxpayer login is disabled. Register or sign in through the Citizens Portal." }),
  { status: 410, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } },
));
