import { writeFile } from "node:fs/promises";
import { Ed25519Keypair } from "@iota/iota-sdk/keypairs/ed25519";

const COMPANY_NAME = "Northern Border Transport";

async function main() {
  const keypair = Ed25519Keypair.generate();
  const address = keypair.getPublicKey().toIotaAddress();
  const privateKey = keypair.getSecretKey();

  const payload = {
    companyName: COMPANY_NAME,
    address,
    privateKey,
    createdAt: new Date().toISOString(),
  };

  await writeFile("company-wallet.json", `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  console.log("Company:", COMPANY_NAME);
  console.log("Address:", address);
  console.log("Private key:", privateKey);
  console.log("Saved wallet file: company-wallet.json");
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error("Failed to create company wallet:", message);
  process.exitCode = 1;
});
