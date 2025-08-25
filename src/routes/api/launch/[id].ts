import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, request }) => {
  const id = params.id;
  try {
    const body = await request.json();
    console.log(`Launch request for rover ${id}:`, body);
    // TODO: integrate with rover command system. For now return success.
    return new Response(JSON.stringify({ success: true, message: `Launch command queued for rover ${id}.` }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    console.error('Error in launch API:', err);
    return new Response(JSON.stringify({ success: false, message: 'Invalid request' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
