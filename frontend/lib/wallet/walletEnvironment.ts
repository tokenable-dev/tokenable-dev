/** Mobile browsers where MetaMask SDK deeplink must stay user-initiated. */
export function isMobileMetaMaskBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent,
  );
}

/** Desktop extension sessions can silently reconnect; mobile should wait for a tap. */
export function shouldAutoReconnectWalletOnMount(): boolean {
  return !isMobileMetaMaskBrowser();
}
