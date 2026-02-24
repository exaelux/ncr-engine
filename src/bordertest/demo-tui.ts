import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import chalk from "chalk";
import { config } from "dotenv";
import ora from "ora";
import terminalLink from "terminal-link";
import type { CanonicalEvent } from "@notia/core";
import { verifyDriverVP } from "../iota/identity-verify.js";
import { IotaNotarizationAdapter } from "../iota/notarization-anchor.js";
import { verifyCargoManifestOnChain } from "../iota/cargo-verify.js";
import resolveIotaName from "../iota/resolve-name.js";
import { verifyVehicleCertOnChain } from "../iota/vehicle-verify.js";
import { runBorderTest } from "./runBorderTest.js";

config();

const STEP_DELAY_MS = 500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractIotaAddressFromDid(did: string): string {
  const prefix = "did:iota:testnet:";
  return did.startsWith(prefix) ? did.slice(prefix.length) : did;
}

function iotaNameProfileUrl(): string {
  return "https://explorer.iota.org/object/0x08be1014a00dc7f106fb0ce9526fa2934d2543b35708385f34d0fb7e34591162?network=testnet";
}

function hasResolvedName(value: string | null | undefined, address: string): value is string {
  return Boolean(value && value !== address && value !== "");
}

function printHeader(): void {
  const title = "NCR — Notia Compliance Runtime";
  const subtitle = "BorderTest Demo";
  const width = Math.max(title.length, subtitle.length) + 4;

  const top = "╔" + "═".repeat(width) + "╗";
  const bottom = "╚" + "═".repeat(width) + "╝";

  const titleLine =
    "║ " + title.padEnd(width - 2, " ") + " ║";
  const subtitleLine =
    "║ " + subtitle.padEnd(width - 2, " ") + " ║";

  console.log(chalk.cyan.bold(top));
  console.log(chalk.cyan.bold(titleLine));
  console.log(chalk.cyan.bold(subtitleLine));
  console.log(chalk.cyan.bold(bottom));
  console.log();
}

function printResultBanner(passed: boolean): void {
  if (passed) {
    const lines = [
      "PPPPPP     A     SSSSS  SSSSS  EEEEE  DDDDD",
      "PP   PP   A A    SS     SS     EE     DD  DD",
      "PPPPPP   AAAAA   SSSSS  SSSSS  EEEE   DD   DD",
      "PP      AA   AA      SS     SS EE     DD  DD",
      "PP      AA   AA  SSSSS  SSSSS  EEEEE  DDDDD",
    ];
    for (const line of lines) {
      console.log(chalk.bold.green(line));
    }
    return;
  }

  const lines = [
    "FFFFFF   A     III  L      EEEEE  DDDDD",
    "FF      A A     I   L      EE     DD  DD",
    "FFFF   AAAAA    I   L      EEEE   DD   DD",
    "FF    AA   AA   I   L      EE     DD  DD",
    "FF    AA   AA  III  LLLLL  EEEEE  DDDDD",
  ];
  for (const line of lines) {
    console.log(chalk.bold.red(line));
  }
}

async function main(): Promise<void> {
  printHeader();

  const raw = await readFile("events/bordertest.json", "utf8");
  const events = JSON.parse(raw) as CanonicalEvent[];

  await sleep(STEP_DELAY_MS);
  const identitySpinner = ora(chalk.cyan("Verifying driver identity...")).start();

  let driverDid = "";
  try {
    const identity = await verifyDriverVP();
    if (!identity.verified) {
      throw new Error("driver VP is not valid");
    }
    driverDid = identity.driverDid;

    const didAddress = extractIotaAddressFromDid(driverDid);
    const didResolvedName = await resolveIotaName(didAddress);

    let resolvedName: string | null = null;
    if (hasResolvedName(didResolvedName, didAddress)) {
      resolvedName = didResolvedName;
    } else {
      const walletAddress =
        process.env.IOTA_WALLET_ADDRESS ??
        "0x12719877dce65c469e4aa362803980da0bf0c4bb2b22a7a798775ca5838f2b10";
      const walletResolvedName = await resolveIotaName(walletAddress);

      if (hasResolvedName(walletResolvedName, walletAddress)) {
        resolvedName = walletResolvedName;
      } else {
        console.error(
          `[identity:name-resolution] unresolved. didAddress=${didAddress}, didResolved=${String(didResolvedName)}, walletAddress=${walletAddress}, walletResolved=${String(walletResolvedName)}`
        );
      }
    }

    const displayName = resolvedName
      ? terminalLink(chalk.yellow(resolvedName), iotaNameProfileUrl())
      : chalk.yellow(driverDid);

    identitySpinner.stopAndPersist({
      symbol: chalk.green("✓"),
      text: `${chalk.cyan("Verifying driver identity...")} ${displayName}`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    identitySpinner.fail(
      `${chalk.red("✗")} ${chalk.cyan("Verifying driver identity...")} ${chalk.red(message)}`
    );
    process.exitCode = 1;
    return;
  }

  await sleep(STEP_DELAY_MS);
  const vehicleSpinner = ora(chalk.cyan("Checking vehicle certificate on IOTA...")).start();

  try {
    const vehicleObjectId =
      process.env.VEHICLE_CERTIFICATE_OBJECT_ID ??
      "0xa099c94a8ee9b7bca40eda065170ec48e836967c6712d5349509af5987e5d226";
    const vehicleCert = await verifyVehicleCertOnChain(vehicleObjectId);

    if (!vehicleCert.valid) {
      throw new Error(vehicleCert.reason ?? "vehicle certificate is not valid");
    }

    const vehicleText = `${vehicleCert.plate} (${vehicleCert.vehicle_class})`;
    const vehicleUrl = `https://explorer.iota.org/object/${vehicleObjectId}?network=testnet`;
    const vehicleLink = terminalLink(chalk.yellow(vehicleText), vehicleUrl);

    vehicleSpinner.stopAndPersist({
      symbol: chalk.green("✓"),
      text: `${chalk.cyan("Checking vehicle certificate on IOTA...")} ${vehicleLink}`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    vehicleSpinner.fail(
      `${chalk.red("✗")} ${chalk.cyan("Checking vehicle certificate on IOTA...")} ${chalk.red(message)}`
    );
    process.exitCode = 1;
    return;
  }

  await sleep(STEP_DELAY_MS);
  const cargoSpinner = ora(chalk.cyan("Verifying cargo manifest on IOTA...")).start();

  try {
    const cargoObjectId =
      process.env.CARGO_MANIFEST_OBJECT_ID ??
      "0x69e29715734c4944137bb4548e6d2b4ee379d1101f5603fb6d8ebb5e249e4c91";
    const cargoManifest = await verifyCargoManifestOnChain(cargoObjectId);

    if (!cargoManifest.valid) {
      throw new Error(cargoManifest.reason ?? "cargo manifest is not valid");
    }

    const cargoUrl = `https://explorer.iota.org/object/${cargoObjectId}?network=testnet`;
    const cargoLink = terminalLink(chalk.yellow(cargoManifest.manifest_id), cargoUrl);

    cargoSpinner.stopAndPersist({
      symbol: chalk.green("✓"),
      text: `${chalk.cyan("Verifying cargo manifest on IOTA...")} ${cargoLink}`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    cargoSpinner.fail(
      `${chalk.red("✗")} ${chalk.cyan("Verifying cargo manifest on IOTA...")} ${chalk.red(message)}`
    );
    process.exitCode = 1;
    return;
  }

  await sleep(STEP_DELAY_MS);
  const complianceSpinner = ora(chalk.cyan("Evaluating cargo compliance...")).start();

  const { compliance } = runBorderTest(events);
  const domains = Object.entries(compliance.evaluated_domains)
    .map(([domain, state]) => `${domain}:${state}`)
    .join(", ");
  complianceSpinner.stopAndPersist({
    symbol: chalk.green("✓"),
    text: `${chalk.cyan("Evaluating cargo compliance...")} ${chalk.cyan(domains)}`,
  });

  console.log();
  console.log(chalk.cyan("-".repeat(72)));
  console.log();

  const passed = compliance.result === "valid";
  printResultBanner(passed);
  console.log();
  console.log(
    chalk.cyan("Compliance Result: ") +
      (passed ? chalk.bold.green("PASSED") : chalk.bold.red("FAILED"))
  );

  if (!passed) {
    process.exitCode = 1;
    return;
  }

  await sleep(STEP_DELAY_MS);
  const anchorSpinner = ora(chalk.cyan("Anchoring proof on IOTA testnet...")).start();

  const complianceHash = createHash("sha256")
    .update(
      JSON.stringify({
        bundle_refs: compliance.bundle_refs,
        result: compliance.result,
        profile_id: "bordertest-v1",
      })
    )
    .digest("hex");

  const adapter = new IotaNotarizationAdapter();

  try {
    const anchor = await adapter.submitProof({
      subject_ref: "vehicle:plate:TRUCK-BorderTest",
      profile_id: "bordertest-v1",
      result: true,
      bundle_hash: complianceHash,
    });

    anchorSpinner.stopAndPersist({
      symbol: chalk.green("✓"),
      text: `${chalk.cyan("Anchoring proof on IOTA testnet...")} ${chalk.green("done")}`,
    });

    const explorerUrl = `https://explorer.iota.org/txblock/${anchor.transaction_id}?network=testnet`;
    const txLink = terminalLink(chalk.yellow(anchor.transaction_id), explorerUrl);
    console.log(chalk.cyan("TX ID: ") + txLink);
    console.log(chalk.cyan("Explorer: ") + chalk.yellow(explorerUrl));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    anchorSpinner.fail(
      `${chalk.red("✗")} ${chalk.cyan("Anchoring proof on IOTA testnet...")} ${chalk.red(message)}`
    );
    process.exitCode = 1;
  }
}

void main();
