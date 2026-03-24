"use strict";

const { Seaport } = require("@opensea/seaport-js");
const { ItemType } = require("@opensea/seaport-js/lib/constants");
const { ethers } = require("ethers");

// Seaport 1.5 — Sepolia & Arbitrum 동일 주소
const SEAPORT_ADDRESS = "0x00000000000000ADc04C56Bf30aC9d3c0aAF14dC";

/**
 * ethers v5 Signer 생성
 * @param {string} privateKey - private key (0x prefix 선택)
 * @param {string} rpcUrl     - RPC endpoint
 */
function createSigner(privateKey, rpcUrl) {
  const key = privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`;
  const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(key, provider);

  // seaport-js v4는 ethers v6의 signTypedData(메서드명)를 호출.
  // ethers v5 Wallet에는 _signTypedData(언더스코어)만 존재하므로 alias 추가.
  wallet.signTypedData = (domain, types, value) =>
    wallet._signTypedData(domain, types, value);

  return wallet;
}

/**
 * Seaport 인스턴스 초기화
 * @param {import("ethers").Wallet} signer
 */
function initSeaport(signer) {
  return new Seaport(signer, {
    overrides: { contractAddress: SEAPORT_ADDRESS },
  });
}

/**
 * ERC-721 NFT 판매 주문 생성 (오프체인 서명, 가스 없음)
 */
async function createSellOrder(seaport, {
  nftContract,
  tokenId,
  priceEth,
  sellerAddress,
  durationSec = 60 * 60 * 24,
}) {
  const endTime = Math.floor(Date.now() / 1000) + durationSec;
  const priceWei = ethers.utils.parseEther(priceEth).toString();

  const { executeAllActions } = await seaport.createOrder(
    {
      offer: [
        {
          itemType: ItemType.ERC721,
          token: nftContract,
          identifier: tokenId.toString(),
        },
      ],
      consideration: [
        {
          amount: priceWei,
          recipient: sellerAddress,
        },
      ],
      endTime: endTime.toString(),
    },
    sellerAddress,
  );

  return await executeAllActions();
}

/**
 * 판매 주문 이행 (구매)
 */
async function fulfillSellOrder(seaport, order, buyerAddress) {
  const { executeAllActions } = await seaport.fulfillOrder({
    order,
    accountAddress: buyerAddress,
  });
  return await executeAllActions();
}

/**
 * 주문 취소 (온체인)
 */
async function cancelOrder(seaport, order, sellerAddress) {
  return await seaport.cancelOrders([order.parameters], sellerAddress);
}

module.exports = {
  SEAPORT_ADDRESS,
  createSigner,
  initSeaport,
  createSellOrder,
  fulfillSellOrder,
  cancelOrder,
};
