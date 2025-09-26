import Web3Modal from 'web3modal';

let web3Modal;

export async function getUniversalConnector() {
  if (!web3Modal) {
    web3Modal = new Web3Modal({
      cacheProvider: true,
      providerOptions: {}, 
    });
  }
  return web3Modal;
}
