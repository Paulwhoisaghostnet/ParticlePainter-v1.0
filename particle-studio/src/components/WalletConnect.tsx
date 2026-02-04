import { useState } from "react";
import { useStudioStore } from "../state/store";
import { walletService } from "../services/walletService";

export function WalletConnect() {
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const walletConnected = useStudioStore((s) => s.walletConnected);
  const walletAddress = useStudioStore((s) => s.walletAddress);
  const walletBalance = useStudioStore((s) => s.walletBalance);
  const setWalletConnected = useStudioStore((s) => s.setWalletConnected);
  const disconnectWalletStore = useStudioStore((s) => s.disconnectWallet);

  const handleConnect = async () => {
    setIsConnecting(true);
    setError(null);
    
    try {
      const { address, balance } = await walletService.connectWallet();
      
      // Sign a message to prove ownership
      const message = `Particle Painter - Authentication\nTimestamp: ${Date.now()}`;
      await walletService.signMessage(message);
      
      setWalletConnected(true, address, balance);
    } catch (err) {
      console.error("Wallet connection failed:", err);
      setError(err instanceof Error ? err.message : "Failed to connect wallet");
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await walletService.disconnectWallet();
      disconnectWalletStore();
    } catch (err) {
      console.error("Failed to disconnect:", err);
    }
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return (
    <div className="walletConnect">
      {!walletConnected ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <button
            className="btn btnPrimary"
            onClick={handleConnect}
            disabled={isConnecting}
            style={{ fontSize: 14 }}
          >
            {isConnecting ? "Connecting..." : "🔗 Connect Wallet"}
          </button>
          {error && (
            <div style={{ 
              fontSize: 11, 
              color: "#ff3d5a", 
              maxWidth: 200,
              wordBreak: "break-word"
            }}>
              {error}
            </div>
          )}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ fontSize: 11, opacity: 0.7 }}>
            {walletAddress && formatAddress(walletAddress)}
          </div>
          <div style={{ fontSize: 10, opacity: 0.6 }}>
            {walletBalance.toFixed(2)} ꜩ
          </div>
          <button
            className="btn btnSm"
            onClick={handleDisconnect}
            style={{ fontSize: 11 }}
          >
            Disconnect
          </button>
        </div>
      )}
    </div>
  );
}
