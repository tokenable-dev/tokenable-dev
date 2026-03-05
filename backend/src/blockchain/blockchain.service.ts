import { Inject, Injectable } from '@nestjs/common';
import { Contract, formatUnits } from 'ethers';
import {
  MARKETPLACE_CONTRACT,
  SKY_NFT_CONTRACT,
  USDC_CONTRACT,
} from './constants/injection-tokens';

export interface MarketplaceListing {
  tokenId: number;
  seller: string;
  price: string;
  tokenURI: string;
}

@Injectable()
export class BlockchainService {
  constructor(
    @Inject(USDC_CONTRACT)
    private readonly usdc: Contract,
    @Inject(SKY_NFT_CONTRACT)
    private readonly skyNft: Contract,
    @Inject(MARKETPLACE_CONTRACT)
    private readonly marketplace: Contract,
  ) {}

  // ── USDC ────────────────────────────────────────────
  async getTokenInfo(): Promise<{ name: string; symbol: string; decimals: number }> {
    const [name, symbol, decimals] = await Promise.all([
      this.usdc.name(),
      this.usdc.symbol(),
      this.usdc.decimals(),
    ]);
    return { name, symbol, decimals: Number(decimals) };
  }

  async getTotalSupply(): Promise<string> {
    const supply = await this.usdc.totalSupply();
    return formatUnits(supply, 6);
  }

  async getTokenBalance(address: string): Promise<string> {
    const balance = await this.usdc.balanceOf(address);
    return formatUnits(balance, 6);
  }

  // ── SkyNFT ───────────────────────────────────────────
  async getNftInfo(): Promise<{ name: string; symbol: string; totalMinted: number }> {
    const [name, symbol, totalMinted] = await Promise.all([
      this.skyNft.name(),
      this.skyNft.symbol(),
      this.skyNft.totalMinted(),
    ]);
    return { name, symbol, totalMinted: Number(totalMinted) };
  }

  async getNftOwner(tokenId: number): Promise<string> {
    return this.skyNft.ownerOf(tokenId);
  }

  async getNftTokenURI(tokenId: number): Promise<string> {
    return this.skyNft.tokenURI(tokenId);
  }

  async getNftBalance(address: string): Promise<number> {
    const balance = await this.skyNft.balanceOf(address);
    return Number(balance);
  }

  async getNftTokensByOwner(address: string): Promise<number[]> {
    const tokenIds: bigint[] = await this.skyNft.tokensOfOwner(address);
    return tokenIds.map(Number);
  }

  // ── Marketplace ──────────────────────────────────────
  async getMarketplaceListings(): Promise<MarketplaceListing[]> {
    const tokenIds: bigint[] = await this.marketplace.getActiveListings();

    const listings = await Promise.all(
      tokenIds.map(async (id) => {
        const tokenId = Number(id);
        const [listing, tokenURI] = await Promise.all([
          this.marketplace.listings(tokenId),
          this.skyNft.tokenURI(tokenId).catch(() => ''),
        ]);
        return {
          tokenId,
          seller: listing.seller as string,
          price: formatUnits(listing.price, 6),
          tokenURI: tokenURI as string,
        };
      }),
    );
    return listings;
  }

  async getMarketplaceListing(tokenId: number): Promise<MarketplaceListing> {
    const [listing, tokenURI] = await Promise.all([
      this.marketplace.listings(tokenId),
      this.skyNft.tokenURI(tokenId).catch(() => ''),
    ]);
    return {
      tokenId,
      seller: listing.seller as string,
      price: formatUnits(listing.price, 6),
      tokenURI: tokenURI as string,
    };
  }
}
