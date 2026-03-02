/**
 * Client helper: updates the org_setup_step cookie via the server.
 * Call this before any forward navigation (Next / Skip / Finish / form submit) so the proxy allows the request.
 *
 * @param step - Next step number (1–10). Use the step the user is navigating TO (e.g. 2 when leaving step1).
 */
export async function setOnboardingStepReached(step: number): Promise<void> {
  if (step < 1 || step > 10) return;
  try {
    await fetch('/api/organization-setup/complete-step', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ step }),
    });
  } catch {
    // Non-blocking; navigation will still work if user already has cookie
  }
}
