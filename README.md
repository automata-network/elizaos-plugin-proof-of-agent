# Proof of Agent Plugin

The Proof of Agent plugin is designed to facilitate token claims using a proof of agent mechanism. It leverages trusted execution environments (TEE) and remote attestation to ensure secure and verified transactions.

## Features

- **Token Claiming**: Allows users to claim tokens by providing a valid Ethereum address and supported asset name.
- **Remote Attestation**: Utilizes TEE and SGX for secure attestation processes.
- **Asset Management**: Queries and manages supported assets and their explorer links.

## Installation

To install the plugin, use the following command:

```bash
pnpm install @elizaos/plugin-proof-of-agent
```

## Usage

### Claim Token Action

The `CLAIM_TOKEN` action allows users to claim tokens by specifying the asset and recipient address. The action validates the input and initiates the claim process.

#### Example

```json
{
  "user": "user1",
  "content": {
    "text": "I want to claim the {{asset}} token to {{address}}",
    "action": "CLAIM_TOKEN"
  }
}
```

### ProofProvider

The `ProofProvider` class handles the attestation and claim submission processes. It ensures that the environment is valid and manages the communication with the relay server.

## Configuration

Ensure that the TEE mode is enabled in your environment settings.

## License

This project is licensed under the Apache License. See the [LICENSE](LICENSE) file for details.
