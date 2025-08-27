import { NetworkProvider } from '@ton/blueprint';
import { getOfferContract } from './utils';

export async function run(provider: NetworkProvider) {
    const ui = provider.ui();
    const offerContract = getOfferContract(provider);

    let status = await offerContract.getStatus();
    ui.write(`Current status: ${status}`);

    await offerContract.sendCancelOffer(provider.sender()); // first | second | admin wallets
}
