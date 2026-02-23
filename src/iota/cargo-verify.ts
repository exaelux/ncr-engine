import { IotaClient } from "@iota/iota-sdk/client";

// Noema principle: read declared states, not raw data.
// We never access shipper, consignee, value, or any commercial content.

export interface CargoManifestResult {
  valid: boolean;
  manifest_id: string;
  reason?: string;
}

export async function verifyCargoManifestOnChain(
  objectId: string
): Promise<CargoManifestResult> {
  const rpcUrl = process.env.IOTA_RPC_URL ?? "https://api.testnet.iota.cafe";
  const client = new IotaClient({ url: rpcUrl });

  const obj = await client.getObject({
    id: objectId,
    options: { showContent: true },
  });

  if (!obj.data?.content || obj.data.content.dataType !== "moveObject") {
    return { valid: false, manifest_id: "", reason: "object_not_found" };
  }

  const fields = (obj.data.content as { fields?: Record<string, unknown> }).fields ?? {};

  // Read only verifiable states — never content
  const active        = fields["active"] as boolean;
  const temperature_ok = fields["temperature_ok"] as boolean;
  const seal_intact   = fields["seal_intact"] as boolean;
  const xray_cleared  = fields["xray_cleared"] as boolean;
  const hazmat        = fields["hazmat"] as boolean;
  const manifest_id   = fields["manifest_id"] as string;

  if (!active)        return { valid: false, manifest_id, reason: "manifest_revoked" };
  if (!temperature_ok) return { valid: false, manifest_id, reason: "cold_chain_failed" };
  if (!seal_intact)   return { valid: false, manifest_id, reason: "seal_broken" };
  if (!xray_cleared)  return { valid: false, manifest_id, reason: "xray_failed" };
  if (hazmat)         return { valid: false, manifest_id, reason: "hazmat_detected" };

  return { valid: true, manifest_id };
}
