import { createHash } from "node:crypto";
import { IotaClient } from "@iota/iota-sdk/client";
import { Ed25519Keypair } from "@iota/iota-sdk/keypairs/ed25519";
import { Transaction } from "@iota/iota-sdk/transactions";
import type { AnchorAdapter, AnchorResult } from "./types.js";

const NOTIA_ANCHOR_PACKAGE =
  "0xf3153d30b3f93d9907d142913ca4811cda174032333fd0128e4dbe5a05359e51";

function getBundleRef(bundle: unknown): string {
  if (bundle === null || typeof bundle !== "object") return "";
  const meaning = (bundle as { meaning?: unknown }).meaning;
  if (meaning === null || typeof meaning !== "object") return "";
  const bundleRef = (meaning as { bundle_ref?: unknown }).bundle_ref;
  return typeof bundleRef === "string" ? bundleRef : "";
}

function hexToBytes(hex: string): number[] {
  const bytes: number[] = [];
  for (let i = 0; i < hex.length; i += 2) {
    bytes.push(parseInt(hex.slice(i, i + 2), 16));
  }
  return bytes;
}

export class IotaAnchorAdapter implements AnchorAdapter {
  private client: IotaClient;
  private keypair: Ed25519Keypair;

  constructor() {
    const rpcUrl =
      process.env.IOTA_RPC_URL ?? "https://api.testnet.iota.cafe";
    const privateKey = process.env.IOTA_PRIVATE_KEY ?? "";

    this.client = new IotaClient({ url: rpcUrl });
    this.keypair = Ed25519Keypair.fromSecretKey(privateKey);
  }

  async anchor(bundle: unknown): Promise<AnchorResult> {
    const anchored_at = new Date().toISOString();
    const bundleRef = getBundleRef(bundle);
    const bundleHashBytes = hexToBytes(bundleRef);

    const tx = new Transaction();
    tx.moveCall({
      target: `${NOTIA_ANCHOR_PACKAGE}::notia_anchor::anchor`,
      arguments: [tx.pure.vector("u8", bundleHashBytes)],
    });

    const result = await this.client.signAndExecuteTransaction({
      transaction: tx,
      signer: this.keypair,
      options: { showEffects: true },
    });

    return {
      network: "IOTA-TESTNET",
      transaction_id: result.digest,
      anchored_at,
      status: result.effects?.status?.status ?? "unknown",
    };
  }
}

export class MockIotaAnchorAdapter implements AnchorAdapter {
  async anchor(bundle: unknown): Promise<AnchorResult> {
    const anchored_at = new Date().toISOString();
    const bundleRef = getBundleRef(bundle);
    return {
      network: "IOTA-MOCK",
      transaction_id: `mock:tx:${bundleRef.slice(0, 16)}`,
      anchored_at,
      status: "confirmed",
    };
  }
}
