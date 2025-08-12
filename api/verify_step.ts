export const config = { runtime: "edge" };

export default async function handler(req: Request): Promise<Response> {
  return new Response(
    JSON.stringify({ ok: true, model: "edge-stub" }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    }
  );
}
