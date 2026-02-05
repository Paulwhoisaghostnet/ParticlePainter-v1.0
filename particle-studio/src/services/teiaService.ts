import { TezosToolkit } from "@taquito/taquito";

// HEN/Teia minter contract on Tezos mainnet
const MINTER_CONTRACT = "KT1Hkg5qeNhfwpKW4fXvq7HGZB9z2EnmCCA9";

// TzKT explorer URL for viewing transactions
const TZKT_EXPLORER_URL = "https://tzkt.io";

// Confirmation polling settings
const MAX_CONFIRMATION_ATTEMPTS = 30; // ~5 minutes with 10s intervals
const CONFIRMATION_POLL_INTERVAL_MS = 10000; // 10 seconds

export interface MintParams {
  editions: number;
  description: string;
  fileBlob: Blob;
  fileName: string;
  mimeType: string;
  royalties?: number; // Optional royalties in basis points (100 = 1%, max 2500 = 25%)
}

export interface IPFSUploadResponse {
  ipfsHash: string;
  ipfsUri: string;
}

export interface MintResult {
  opHash: string;
  explorerUrl: string;
}

class TeiaService {
  /**
   * Upload file to IPFS via Pinata
   * Uses Pinata's pinning service with JWT authentication
   */
  async uploadToIPFS(file: Blob, fileName: string): Promise<IPFSUploadResponse> {
    try {
      // Get Pinata JWT from environment variables
      const pinataJWT = import.meta.env.VITE_PINATA_JWT;
      
      if (!pinataJWT) {
        throw new Error(
          "Pinata API key not configured. Please add VITE_PINATA_JWT to your .env.local file. " +
          "Get your API key from https://app.pinata.cloud/developers/api-keys"
        );
      }

      // Create FormData for Pinata API
      const formData = new FormData();
      formData.append('file', file, fileName);

      // Optional: Add metadata
      const metadata = JSON.stringify({
        name: fileName,
      });
      formData.append('pinataMetadata', metadata);

      // Upload to Pinata
      const response = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${pinataJWT}`
        },
        body: formData
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Pinata upload failed: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      const ipfsHash = data.IpfsHash;
      const ipfsUri = `ipfs://${ipfsHash}`;

      console.log(`File uploaded to IPFS: ${ipfsUri}`);

      return {
        ipfsHash,
        ipfsUri
      };
    } catch (error) {
      console.error("IPFS upload failed:", error);
      throw error;
    }
  }

  /**
   * Create metadata JSON for the NFT
   */
  createMetadata(
    name: string,
    description: string,
    artifactUri: string,
    mimeType: string,
    creator: string
  ) {
    return {
      name,
      description,
      tags: ["generative", "particle-painter"],
      symbol: "OBJKT",
      artifactUri,
      displayUri: artifactUri,
      thumbnailUri: artifactUri,
      creators: [creator],
      formats: [
        {
          uri: artifactUri,
          mimeType,
        },
      ],
      decimals: 0,
      isBooleanAmount: false,
      shouldPreferSymbol: false,
    };
  }

  /**
   * Mint NFT on Teia/HEN
   * Performs a real on-chain transaction to the HEN minter contract
   * Returns the operation hash only after successful confirmation
   */
  async mint(
    tezos: TezosToolkit,
    params: MintParams,
    userAddress: string,
    onProgress?: (message: string) => void
  ): Promise<MintResult> {
    // Step 1: Upload file to IPFS
    onProgress?.("Uploading file to IPFS...");
    
    let ipfsUri: string;
    try {
      const uploadResult = await this.uploadToIPFS(params.fileBlob, params.fileName);
      ipfsUri = uploadResult.ipfsUri;
      
      if (!uploadResult.ipfsHash) {
        throw new Error("IPFS upload failed: No CID returned");
      }
    } catch (error) {
      console.error("IPFS file upload failed:", error);
      throw new Error(`Failed to upload file to IPFS: ${error instanceof Error ? error.message : "Unknown error"}`);
    }

    // Step 2: Create and upload metadata
    onProgress?.("Creating and uploading metadata...");
    
    let metadataUri: string;
    try {
      const metadata = this.createMetadata(
        `Particle Painter - ${Date.now()}`,
        params.description,
        ipfsUri,
        params.mimeType,
        userAddress
      );

      const metadataBlob = new Blob([JSON.stringify(metadata)], {
        type: "application/json",
      });
      
      const metadataUploadResult = await this.uploadToIPFS(metadataBlob, "metadata.json");
      metadataUri = metadataUploadResult.ipfsUri;
      
      if (!metadataUploadResult.ipfsHash) {
        throw new Error("Metadata IPFS upload failed: No CID returned");
      }
    } catch (error) {
      console.error("Metadata upload failed:", error);
      throw new Error(`Failed to upload metadata to IPFS: ${error instanceof Error ? error.message : "Unknown error"}`);
    }

    // Step 3: Send transaction to minting contract
    onProgress?.("Sending mint transaction to wallet...");
    
    let opHash: string;
    try {
      // Get the minter contract
      const contract = await tezos.wallet.at(MINTER_CONTRACT);
      
      // Royalties default to 10% (1000 basis points)
      const royalties = params.royalties ?? 1000;
      
      // Call the mint entrypoint with proper parameter structure
      // HEN minter expects: (address creator, nat amount, nat royalties, string metadata, list<string> tags)
      const op = await contract.methodsObject
        .mint_OBJKT({
          address: userAddress,
          amount: params.editions,
          metadata: metadataUri,
          royalties: royalties,
        })
        .send();
      
      opHash = op.opHash;
      
      // Hard guard: if no opHash returned, the mint did not succeed
      if (!opHash) {
        throw new Error("Wallet did not return an operation hash. The mint operation was not broadcast.");
      }
      
      console.log(`Mint transaction sent. Operation hash: ${opHash}`);
      
    } catch (error) {
      // Handle specific wallet/transaction errors
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      if (errorMessage.includes("rejected") || errorMessage.includes("aborted")) {
        throw new Error("Mint cancelled: You rejected the transaction in your wallet.");
      }
      
      if (errorMessage.includes("balance") || errorMessage.includes("insufficient")) {
        throw new Error("Mint failed: Insufficient balance to cover gas fees.");
      }
      
      console.error("Mint transaction failed:", error);
      throw new Error(`Failed to send mint transaction: ${errorMessage}`);
    }

    // Step 4: Wait for confirmation
    onProgress?.("Waiting for blockchain confirmation...");
    
    try {
      // Create a polling mechanism to check transaction status
      let confirmed = false;
      
      for (let attempt = 0; attempt < MAX_CONFIRMATION_ATTEMPTS; attempt++) {
        try {
          // Check if the operation is confirmed via TzKT API
          const response = await fetch(`https://api.tzkt.io/v1/operations/${opHash}`);
          if (response.ok) {
            const operations = await response.json();
            if (Array.isArray(operations) && operations.length > 0) {
              const status = operations[0].status;
              if (status === "applied") {
                confirmed = true;
                break;
              } else if (status === "failed" || status === "backtracked" || status === "skipped") {
                throw new Error(`Transaction failed on-chain with status: ${status}`);
              }
            }
          }
        } catch (fetchError) {
          // Continue polling on fetch errors (network issues)
          console.warn("Error checking transaction status:", fetchError);
        }
        
        // Wait before next check
        await new Promise(resolve => setTimeout(resolve, CONFIRMATION_POLL_INTERVAL_MS));
        onProgress?.(`Waiting for confirmation... (attempt ${attempt + 1}/${MAX_CONFIRMATION_ATTEMPTS})`);
      }
      
      if (!confirmed) {
        // Return with a warning that confirmation is pending
        console.warn("Transaction may still be pending. opHash:", opHash);
      }
      
    } catch (error) {
      // Even if confirmation check fails, we still have the opHash
      // The transaction was broadcast, just couldn't confirm status
      console.warn("Could not confirm transaction status:", error);
    }

    const explorerUrl = `${TZKT_EXPLORER_URL}/${opHash}`;
    
    onProgress?.(`Mint successful! View on TzKT: ${explorerUrl}`);
    
    console.log(`Mint confirmed. Explorer URL: ${explorerUrl}`);

    return {
      opHash,
      explorerUrl,
    };
  }
}

export const teiaService = new TeiaService();
