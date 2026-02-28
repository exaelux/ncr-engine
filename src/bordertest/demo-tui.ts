import { createHash } from "node:crypto";
import * as readline from "node:readline";
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

config({ quiet: true });

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

type DemoTuiOptions = {
  showHeader?: boolean;
};

export async function main(options: DemoTuiOptions = {}): Promise<void> {
  const showHeader = options.showHeader ?? true;
  let restart = true;
  let hasPrintedHeader = false;
  while (restart) {
    restart = false;
    if (showHeader && !hasPrintedHeader) {
      printHeader();
      hasPrintedHeader = true;
    }

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
  const companyAddress = process.env.COMPANY_ADDRESS ?? "";
  const companyName = companyAddress ? await resolveIotaName(companyAddress) : null;
  const companyNameUrl = "https://explorer.iota.org/object/0xbb390c55314f271eb904e598954711fda075af8604b33c948712f29810fe4386?network=testnet";
  const companyBadge = companyName
    ? chalk.yellow(terminalLink(companyName, companyNameUrl))
    : "";
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
      text: `${chalk.cyan("Checking vehicle certificate on IOTA...")} ${vehicleLink}\n  ${chalk.cyan("└─ Certified by:")} ${companyBadge.trim()}`,
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
      text: `${chalk.cyan("Verifying cargo manifest on IOTA...")} ${cargoLink}\n  ${chalk.cyan("└─ Declared by:")} ${companyBadge.trim()}`,
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
  const domainMap: Record<string, string> = {
    identity: "Driver",
    token: "Vehicle",
    supply: "Cargo",
  };
  const domainDisplay = Object.entries(compliance.evaluated_domains)
    .map(([domain, state]) => {
      const label = domainMap[domain] ?? domain;
      const icon = state === "valid" ? chalk.green("✓") : chalk.red("✗");
      const text = state === "valid" ? chalk.green(label) : chalk.red(label);
      return `${text} ${icon}`;
    })
    .join(chalk.cyan(" · "));
  complianceSpinner.stopAndPersist({
    symbol: chalk.green("✓"),
    text: `${chalk.cyan("NCR compliance...")} ${domainDisplay}`,
  });

  console.log();
  console.log(chalk.cyan("-".repeat(72)));
  console.log();

  let runtimeState: "valid" | "hold" | "reject" = compliance.result === "valid" ? "valid" : "reject";

  const doAnchor = async (result: boolean, state: "valid" | "hold", manual_override: boolean) => {
    const anchorSpinner = ora(chalk.cyan("Registering compliance proof...")).start();
    const payload = {
      bundle_refs: compliance.bundle_refs,
      result,
      state,
      manual_override,
      timestamp: Date.now(),
    };
    const complianceHash = createHash("sha256").update(JSON.stringify(payload)).digest("hex");
    const adapter = new IotaNotarizationAdapter();
    try {
      const tx = await adapter.submitProof({
        subject_ref: "vehicle:plate:TRUCK-BorderTest",
        profile_id: "bordertest-v1",
        result,
        bundle_hash: complianceHash,
      });
      anchorSpinner.stopAndPersist({ symbol: chalk.green("✓"), text: chalk.green("Registered") });
      const explorerUrl = `https://explorer.iota.org/txblock/${tx.transaction_id}?network=testnet`;
      console.log(chalk.cyan("TX ID: ") + chalk.yellow(terminalLink(tx.transaction_id, explorerUrl)));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      anchorSpinner.fail(chalk.red(`Anchor failed: ${msg}`));
    }
  };

  const askPassword = (prompt: string): Promise<string> => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise(resolve => rl.question(prompt, ans => { rl.close(); resolve(ans.trim()); }));
  };

  const askMenu = (options: string[]): Promise<string> => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    console.log();
    options.forEach(o => console.log(chalk.cyan(o)));
    return new Promise(resolve => rl.question(chalk.cyan("> "), ans => { rl.close(); resolve(ans.trim()); }));
  };

  printResultBanner(runtimeState === "valid");
  console.log();
  const stateColor = runtimeState === "valid" ? chalk.bold.green : chalk.bold.red;
  console.log(chalk.cyan("Compliance State: ") + stateColor(runtimeState.toUpperCase()));
  console.log();

    if (runtimeState === "reject") {
    console.log(chalk.red("Compliance failed. No blockchain operation executed."));
    const choice = await askMenu(["[1] Exit", "[2] Wait for new registration"]);
      if (choice === "2") {
        console.log(chalk.cyan("\nWaiting for new registration...\n"));
        restart = true;
      }
      if (restart) {
        continue;
      }
      return;
    }

    // VALID — operator menu
    const choice = await askMenu(["[1] Continue", "[2] Hold (manual)", "[3] Reject (manual)"]);

    if (choice === "1") {
      await doAnchor(true, "valid", false);
      console.log(chalk.cyan("\nWaiting for next compliance check...\n"));
      await sleep(2000);
      restart = true;
      continue;

    } else if (choice === "2") {
      const pwd = await askPassword(chalk.yellow("Password: "));
      if (pwd !== "1234") { console.log(chalk.red("Wrong password.")); return; }
      runtimeState = "hold";
      console.log(chalk.yellow("\nState Transition: VALID → HOLD"));
      console.log(chalk.yellow("Manual Hold applied\n"));
      printResultBanner(false);
      await doAnchor(false, "hold", true);
      const choice2 = await askMenu(["[1] Manual Pass", "[2] Exit"]);
      if (choice2 === "1") {
        const pwd2 = await askPassword(chalk.yellow("Password: "));
        if (pwd2 !== "1234") { console.log(chalk.red("Wrong password.")); return; }
        console.log(chalk.green("\nState Transition: HOLD → PASSED"));
        console.log(chalk.green("Manual override registered"));
        console.log(chalk.green("Registered\n"));
      }

    } else if (choice === "3") {
      runtimeState = "reject";
      console.log(chalk.red("\nState Transition: VALID → REJECT"));
      console.log(chalk.red("Corrupted file, contact your provider."));
      console.log(chalk.red("No blockchain operation executed.\n"));
      const choice2 = await askMenu(["[1] Exit", "[2] Wait for new registration"]);
      if (choice2 === "2") {
        console.log(chalk.cyan("\nWaiting for new registration...\n"));
        restart = true;
        continue;
      }
    }
  }
}
// void main();
