import { type IAgentRuntime, type Memory, type State, type HandlerCallback, elizaLogger, composeContext, generateObjectDeprecated, ModelClass, Action, parseJSONObjectFromText } from "@elizaos/core";
import { ProofProvider } from "../providers/proofProvider"
import { TEEMode } from "@elizaos/plugin-tee";

const claimTemplate = `
Respond with a JSON markdown block containing only the extracted values. Use null for any values that cannot be determined.

Example response:
\`\`\`json
{
    "recipient": "0x3b1f8782d6023137b8ff26f82de164abdb6760ef",
    "assets": ["holesky_eth"]
}
\`\`\`

<recent_messages>
{{recentMessages}}
</recent_messages>

Here's a list of supported assets:
<supported_assets>
{{supportedAssets}}
</supported_assets>

Here's a list of explorer links for every assets:
<assets_explorer>
{{assetsExplorer}}
</assets_explorer>

Your goal is to extract the following information about the claim:
1. Asset name to claim (must be one of the supported assets)
2. Recipient address (must be a valid Ethereum address)

generate the message follow these steps, put it into the <analysis> tag:
1. Identify the relevant information from the user's message, not from the agent, only use the message within 5 mins:
   - Quote the message mentioning the assets.
     - only use the message within 5 min
   - Quote the part mentioning the recipient address.
     - Prefer to use the most recently address
     - only use the message within 5 min

2. Validate each piece of information:
   - Assets: List all supported assets and check if the mentioned asset is in the list, the length must be greater than 0. if the asset name can be fuzzy match.
   - Address: Check that it starts with "0x" and count the number of characters (should be 42).

3. If any information is missing or invalid, prepare an appropriate error message.

4. If all information is valid, summarize your findings.

5. Prepare the JSON structure based on your analysis.

6. If there some reason that you can't extract the data, please guide the user how to provide it, it should matches the character's style and voice, and put it to the <hint> tag.

7. If the validation passed, you should prepare an appropriate message to guide the user what to do after the claim successed, and put it to the <claimed> tags:
   - Tell the user that which assets are request to claim, claim to which recipient
   - Tell the user that the claim is on the way, check it from the explorer links, multiple assets should have multiple links.
   - The explorer links is different from every assets. you can compose it by \`$explorerURL/address/$recipient\` the format.
   - The order of assets_explorer is same as the supported_assets
   - Multiple explorer links should separate with different lines

All fields are required. The JSON should have this structure:



\`\`\`json
{
    "recipient": string,
    "assets": string[],
    "analysis": string,
    "hint": string,
    "claimed": string
}
\`\`\`

Remember:
- The assets name must be a string and must exactly match one of the supported assets, and the list should only exactly from one message, do not aggregate from multiple messages.
- The recipient address must be a valid Ethereum address starting with "0x".
- The data extract must from the user message.
- The JSON output should be properly formatted using Markdown blocks.

Now, process the user's request and provide your response.
`;

export const claimTokenAction: Action = {
    name: "CLAIM_TOKEN",
    similes: ["PROOF_OF_AGENT", "proofof_agent"],
    description: "claim token from proof of agent",
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state?: State,
        _options?: { [key: string]: unknown },
        callback?: HandlerCallback,
    ) => {
        try {
            // Get the remote attestation of the agentId
            const agentId = runtime.agentId;
            const teeMode = runtime.getSetting("TEE_MODE");
            const sgxMode = runtime.getSetting("SGX");
            const poaRelay = (runtime.getSetting("PROOF_OF_AGENT_RELAY") as string) || "https://proof-of-agent-relay.ata.network";

            const provider = new ProofProvider(poaRelay, sgxMode, teeMode);
            if (!provider.isValid()) {
                if (callback) {
                    callback({ text: "Failed: You can only claim tokens after enabling TEE" });
                }
                return false;
            }

            // Initialize or update state
            if (!state) {
                state = (await runtime.composeState(message)) as State;
            } else {
                state = await runtime.updateRecentMessageState(state);
            }

            const assetsInfo = await provider.queryAssets();

            const queryContext = composeContext({
                state: {
                    ...state,
                    supportedAssets: assetsInfo.assets,
                    assetsExplorer: assetsInfo.explorers,
                },
                template: claimTemplate,
            });

            // Generate transfer content
            const content = await generateObjectDeprecated({
                runtime,
                context: queryContext,
                modelClass: ModelClass.LARGE,
            });

            elizaLogger.info("content: " + JSON.stringify(content));

            if (!content.assets || content.assets.length == 0 || !content.recipient) {
                if (callback) {
                    callback({ text: content.hint, action: "CONTINUE" });
                }
                return false;
            }

            const requestData = await provider.requestClaim(content);
            if (requestData.error) {
                if (callback) {
                    callback({ text: "Failed: " + requestData.error });
                }
                return false;
            }

            const quote = await provider.generateAttestation(requestData.hash);
            if (!quote) {
                if (callback) {
                    callback({ text: "Generate Proof Failed: please specify the TEE Mode" });
                }
                return false;
            }

            const result = await provider.submitClaim({
                attestation_report: quote,
                context: requestData.context,
            });
            if (result.error) {  // Changed from requestData.error to result.error
                if (callback) {
                    callback({ text: "Failed: " + result.error });  // Changed to result.error
                }
                return false;
            }

            const output = JSON.stringify(requestData);
            const text = result.success ? content.claimed : "Claim Failed";
            if (callback) {
                callback({ text: text });
            }
            return true;
        } catch (error) {
            console.error("Failed to fetch claim token: ", error);
            return false;
        }
    },
    validate: async (runtime: IAgentRuntime) => {
        const teeMode = runtime.getSetting("TEE_MODE");
        const sgxMode = runtime.getSetting("SGX");
        return (teeMode && teeMode != TEEMode.OFF) || !!sgxMode;
    },
    examples: [
        [
            {
                user: "{{user1}}",
                content: {
                    text: "I want to claim the {{asset}} token to {{ethereum address}}",
                    action: "CLAIM_TOKEN",
                },
            }
        ],
    ],
    suppressInitialMessage: true,
};