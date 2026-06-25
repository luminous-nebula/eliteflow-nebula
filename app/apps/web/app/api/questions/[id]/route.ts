import { query } from '@eliteflow/db';
import { getOperator } from '../../../../lib/auth';

export const dynamic = 'force-dynamic';

/** Answer (resolve) a question from the inbox. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  if (!(await getOperator())) return Response.json({ error: 'unauthorized' }, { status: 401 });
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { answer?: string };
  const answer = (body.answer ?? '').trim();
  if (!answer) {
    return Response.json({ error: 'answer is required' }, { status: 400 });
  }
  const { rowCount } = await query(
    `UPDATE questions SET status = 'answered', answer = $1, resolved_at = now()
      WHERE id = $2 AND status = 'open'`,
    [answer, Number(id)],
  );
  if (!rowCount) {
    return Response.json({ error: 'question not found or already resolved' }, { status: 404 });
  }
  return Response.json({ ok: true });
}
