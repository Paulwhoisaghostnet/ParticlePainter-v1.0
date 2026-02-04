import { BeaconWallet } from "@taquito/beacon-wallet";
import { TezosToolkit } from "@taquito/taquito";
import { NetworkType, BeaconEvent, AccountInfo } from "@airgap/beacon-sdk";

// Use mainnet for production
const RPC_URL = "https://mainnet.api.tez.ie";
const NETWORK_TYPE = NetworkType.MAINNET;

class WalletService {
  private wallet: BeaconWallet | null = null;
  private tezos: TezosToolkit | null = null;
  private userAddress: string | null = null;
  private initialized: boolean = false;
  private activeAccountResolver: ((account: AccountInfo) => void) | null = null;
  private connectionTimeoutId: ReturnType<typeof setTimeout> | null = null;

  private async initialize() {
    if (this.initialized) return;
    
    try {
      // Initialize wallet lazily
      this.wallet = new BeaconWallet({
        name: "Particle Painter",
        iconUrl: "https://tezostaquito.io/img/favicon.png",
        preferredNetwork: NETWORK_TYPE,
      });

      // Subscribe to ACTIVE_ACCOUNT_SET event before requesting permissions
      // This is required by Beacon SDK v4.x for proper account management
      await this.wallet.client.subscribeToEvent(
        BeaconEvent.ACTIVE_ACCOUNT_SET,
        (account) => {
          if (account) {
            this.userAddress = account.address;
            // Resolve any pending connection promise and clear the timeout
            if (this.activeAccountResolver) {
              if (this.connectionTimeoutId) {
                clearTimeout(this.connectionTimeoutId);
                this.connectionTimeoutId = null;
              }
              this.activeAccountResolver(account);
              this.activeAccountResolver = null;
            }
          }
        }
      );

      this.initialized = true;
    } catch (error) {
      console.error("Failed to initialize wallet:", error);
      throw error;
    }
  }

  async connectWallet(): Promise<{ address: string; balance: number }> {
    try {
      // Initialize wallet on first use
      await this.initialize();
      
      if (!this.wallet) {
        throw new Error("Failed to initialize wallet");
      }

      // Create a promise to wait for the active account from the subscription
      const activeAccountPromise = new Promise<AccountInfo>((resolve, reject) => {
        this.activeAccountResolver = resolve;
        // Set a timeout in case the account is never set
        this.connectionTimeoutId = setTimeout(() => {
          if (this.activeAccountResolver) {
            this.activeAccountResolver = null;
            this.connectionTimeoutId = null;
            reject(new Error("Timeout waiting for active account"));
          }
        }, 60000); // 60 second timeout
      });

      // Request permissions - this will trigger ACTIVE_ACCOUNT_SET event
      await this.wallet.requestPermissions();
      
      // Wait for the active account from the subscription
      const activeAccount = await activeAccountPromise;
      
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
        // Reset initialized flag to allow full reinitialization on next connect
        // This ensures the ACTIVE_ACCOUNT_SET subscription is set up again
        this.initialized = false;
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
