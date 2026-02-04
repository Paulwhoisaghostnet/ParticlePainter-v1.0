import { TezosToolkit } from "@taquito/taquito";

// Note: TEIA contract integration would require specific contract ABI and entrypoints
// For now, this service prepares files and opens Teia's web interface for minting

export interface MintParams {
  editions: number;
  description: string;
  fileBlob: Blob;
  fileName: string;
  mimeType: string;
}

export interface IPFSUploadResponse {
  ipfsHash: string;
  ipfsUri: string;
}

class TeiaService {
  /**
   * Upload file to IPFS via public gateway
   * Note: For production, use a proper IPFS pinning service like Pinata or NFT.Storage with API keys
   */
  async uploadToIPFS(file: Blob, fileName: string): Promise<IPFSUploadResponse> {
    try {
      // For now, we'll use a public IPFS gateway
      // In production, you should use NFT.Storage, Pinata, or another pinning service
      // Example with NFT.Storage:
      // const client = new NFTStorage({ token: API_KEY })
      // const cid = await client.storeBlob(file)
      
      // Since public endpoints require auth, we'll throw an error guiding the user
      throw new Error(
        "IPFS upload requires configuration. Please set up an IPFS pinning service " +
        "(NFT.Storage, Pinata, or Web3.Storage) with proper API keys."
      );
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
   * Mint NFT on Teia
   * This simplified version uploads to IPFS and prepares metadata,
   * then opens Teia with the prepared data for the user to complete the mint
   */
  async mint(
    tezos: TezosToolkit,
    params: MintParams,
    userAddress: string,
    onProgress?: (message: string) => void
  ): Promise<string> {
    try {
      onProgress?.("Uploading file to IPFS...");

      // Upload file to IPFS
      const { ipfsUri, ipfsHash } = await this.uploadToIPFS(params.fileBlob, params.fileName);

      onProgress?.("Creating metadata...");

      // Create metadata
      const metadata = this.createMetadata(
        `Particle Painter - ${Date.now()}`,
        params.description,
        ipfsUri,
        params.mimeType,
        userAddress
      );

      // Upload metadata to IPFS
      const metadataBlob = new Blob([JSON.stringify(metadata)], {
        type: "application/json",
      });
      const { ipfsUri: metadataUri } = await this.uploadToIPFS(
        metadataBlob,
        "metadata.json"
      );

      onProgress?.("Opening Teia to complete mint...");

      // Open Teia with pre-filled data
      // Teia uses query parameters to pre-fill the minting form
      const teiaUrl = new URL("https://teia.art/mint");
      teiaUrl.searchParams.set("ipfs", ipfsHash);
      teiaUrl.searchParams.set("editions", params.editions.toString());
      teiaUrl.searchParams.set("description", params.description);
      
      window.open(teiaUrl.toString(), "_blank", "noopener,noreferrer");

      onProgress?.("Upload complete! Complete the mint on Teia.");

      return ipfsHash; // Return IPFS hash as confirmation
    } catch (error) {
      console.error("Minting preparation failed:", error);
      throw error;
    }
  }
}

export const teiaService = new TeiaService();
