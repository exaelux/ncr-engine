import { IotaGraphQLClient } from "@iota/iota-sdk/graphql";
import { IotaNamesClient } from "@iota/iota-names-sdk";

async function resolveIotaName(address: string): Promise<string | null> {
  try {
    const graphqlUrl = "https://graphql.testnet.iota.cafe";
    const iotaNamesClient = new IotaNamesClient({
      graphQlClient: new IotaGraphQLClient({ url: graphqlUrl }),
      network: "testnet" as any,
    });

    return await iotaNamesClient.getPublicName(address);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[resolveIotaName] failed for ${address}: ${message}`);
    return null;
  }
}

export { resolveIotaName };
export default resolveIotaName;
