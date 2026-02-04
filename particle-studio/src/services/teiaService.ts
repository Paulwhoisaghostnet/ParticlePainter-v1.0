import { TezosToolkit } from "@taquito/taquito";

// TEIA FA2 contract address on mainnet
const TEIA_MINTER_CONTRACT = "KT1RJ6PbjHpwc3M5rw5s2Nbmefwbuwbdxton";

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
   * Upload file to IPFS via Teia's pinning service or Pinata
   */
  async uploadToIPFS(file: Blob, fileName: string): Promise<IPFSUploadResponse> {
    try {
      // Create FormData for file upload
      const formData = new FormData();
      formData.append("file", file, fileName);

      // Use public IPFS gateway for upload
      // Note: For production, you should use a proper IPFS pinning service like Pinata or NFT.Storage
      const response = await fetch("https://ipfs.infura.io:5001/api/v0/add", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to upload to IPFS");
      }

      const data = await response.json();
      const ipfsHash = data.Hash;
      const ipfsUri = `ipfs://${ipfsHash}`;

      return { ipfsHash, ipfsUri };
    } catch (error) {
      console.error("IPFS upload failed:", error);
      throw new Error("Failed to upload file to IPFS");
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
