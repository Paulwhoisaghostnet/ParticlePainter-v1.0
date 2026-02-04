import { BeaconWallet } from "@taquito/beacon-wallet";
import { TezosToolkit } from "@taquito/taquito";
import { NetworkType } from "@airgap/beacon-sdk";

// Use mainnet for production
const RPC_URL = "https://mainnet.api.tez.ie";
const NETWORK_TYPE = NetworkType.MAINNET;

class WalletService {
  private wallet: BeaconWallet | null = null;
  private tezos: TezosToolkit | null = null;
  private userAddress: string | null = null;

  async connectWallet(): Promise<{ address: string; balance: number }> {
    try {
      // Initialize wallet if not already done
      if (!this.wallet) {
        this.wallet = new BeaconWallet({
          name: "Particle Painter",
          iconUrl: "https://tezostaquito.io/img/favicon.png",
          preferredNetwork: NETWORK_TYPE,
        });
      }

      // Request permissions
      const permissions = await this.wallet.requestPermissions();
      
      // Get active account
      const activeAccount = await this.wallet.client.getActiveAccount();
      if (!activeAccount) {
        throw new Error("No active account found");
      }

      this.userAddress = activeAccount.address;

      // Initialize Tezos toolkit
      this.tezos = new TezosToolkit(RPC_URL);
      this.tezos.setWalletProvider(this.wallet);

      // Get balance
      const balance = await this.tezos.tz.getBalance(this.userAddress);
      const balanceInTez = balance.toNumber() / 1000000;

      return {
        address: this.userAddress,
        balance: balanceInTez,
      };
    } catch (error) {
      console.error("Failed to connect wallet:", error);
      throw error;
    }
  }

  async disconnectWallet(): Promise<void> {
    try {
      if (this.wallet) {
        await this.wallet.clearActiveAccount();
        this.wallet = null;
        this.tezos = null;
        this.userAddress = null;
      }
    } catch (error) {
      console.error("Failed to disconnect wallet:", error);
      throw error;
    }
  }

  async signMessage(message: string): Promise<string> {
    if (!this.wallet) {
      throw new Error("Wallet not connected");
    }

    try {
      const result = await this.wallet.client.requestSignPayload({
        payload: message,
      });
      return result.signature;
    } catch (error) {
      console.error("Failed to sign message:", error);
      throw error;
    }
  }

  isConnected(): boolean {
    return this.userAddress !== null;
  }

  getUserAddress(): string | null {
    return this.userAddress;
  }

  getTezos(): TezosToolkit | null {
    return this.tezos;
  }

  getWallet(): BeaconWallet | null {
    return this.wallet;
  }
}

// Export a singleton instance
export const walletService = new WalletService();
