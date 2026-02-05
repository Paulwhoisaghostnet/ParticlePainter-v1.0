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
