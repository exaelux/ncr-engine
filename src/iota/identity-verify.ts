export interface DriverIdentityResult {
  verified: boolean;
  driverDid: string;
  credentialCount: number;
}

export async function verifyDriverVP(): Promise<DriverIdentityResult> {
  const endpoint = process.env.IDENTITY_SERVICE_URL ?? "http://localhost:3002";
  const url = `${endpoint}/driver/verify`;
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Identity service unreachable at ${url}. Start backend at ~/notia-lab/notia-engine/services/iota-identity-backend (error: ${message})`
    );
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    const detail = body ? ` - ${body}` : "";
    throw new Error(`Identity service error: ${response.status}${detail}`);
  }

  const data = await response.json() as {
    valid: boolean;
    holder: string;
    credential_count: number;
  };

  return {
    verified: data.valid,
    driverDid: data.holder,
    credentialCount: data.credential_count,
  };
}
