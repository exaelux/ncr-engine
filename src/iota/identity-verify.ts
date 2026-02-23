export interface DriverIdentityResult {
  verified: boolean;
  driverDid: string;
  credentialCount: number;
}

export async function verifyDriverVP(): Promise<DriverIdentityResult> {
  const endpoint = process.env.IDENTITY_SERVICE_URL ?? 'http://localhost:3002';

  const response = await fetch(`${endpoint}/driver/verify`, {
    method: 'POST',
  });

  if (!response.ok) {
    throw new Error(`Identity service error: ${response.status}`);
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
