import { IotaClient } from '@iota/iota-sdk/client';
import { Ed25519Keypair } from '@iota/iota-sdk/keypairs/ed25519';
import { Transaction } from '@iota/iota-sdk/transactions';

export class TestnetIotaAnchorAdapter {
  private client: IotaClient;
  private keypair: Ed25519Keypair;
  private readonly network = 'iota-testnet';

  constructor() {
    const rpc = process.env.IOTA_RPC_URL;
    const privateKey = process.env.IOTA_PRIVATE_KEY;

    if (!rpc) throw new Error('Missing IOTA_RPC_URL');
    if (!privateKey) throw new Error('Missing IOTA_PRIVATE_KEY');

    this.client = new IotaClient({ url: rpc });
    this.keypair = Ed25519Keypair.fromSecretKey(privateKey);
  }

  async anchor(bundle: any) {
    if (!bundle?.meaning?.bundle_ref) {
      throw new Error('Invalid bundle: missing bundle_ref');
    }

    const bundleRefHex = bundle.meaning.bundle_ref;

    const bundleBytes = Uint8Array.from(Buffer.from(bundleRefHex, 'hex'));

    const tx = new Transaction();

    tx.moveCall({
      target:
        '0xf3153d30b3f93d9907d142913ca4811cda174032333fd0128e4dbe5a05359e51::notia_anchor::anchor',
      arguments: [
        tx.pure.vector('u8', bundleBytes),
      ],
    });

    const result = await this.client.signAndExecuteTransaction({
      transaction: tx,
      signer: this.keypair,
    });

    return {
      network: this.network,
      transaction_id: result.digest,
      status: 'confirmed',
      anchored_at: new Date().toISOString(),
    };
  }
}
