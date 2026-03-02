import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const COOKIE_NAME = 'org_setup_step';
const MAX_AGE = 60 * 60 * 24 * 7; // 7 days

/**
 * POST /api/organization-setup/complete-step
 * Sets the highest reached onboarding step in an HTTP-only cookie (org_setup_step).
 * Called by the client helper before forward navigation so the proxy allows the next step.
 *
 * Body: { step: number } — step number reached (1–10). Cookie is set to max(current, step).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const step = typeof body?.step === 'number' ? body.step : parseInt(body?.step, 10);

    if (Number.isNaN(step) || step < 1 || step > 10) {
      return NextResponse.json(
        { error: 'Invalid step; must be 1–10' },
        { status: 400 }
      );
    }

    const current = request.cookies.get(COOKIE_NAME)?.value;
    const currentVal = current ? parseInt(current, 10) : 0;
    const newVal = Number.isNaN(currentVal) ? step : Math.max(currentVal, step);

    const response = NextResponse.json({ ok: true, step: newVal });
    response.cookies.set(COOKIE_NAME, String(newVal), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      sameSite: 'lax',
      maxAge: MAX_AGE,
    });

    return response;
  } catch {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    );
  }
}
