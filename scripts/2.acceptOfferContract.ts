import { NetworkProvider } from '@ton/blueprint';
import offerConfig from '../config/offer.config';
import { getOfferContract } from './utils';

export async function run(provider: NetworkProvider) {
    const ui = provider.ui();
    const offerContract = getOfferContract(provider);

    let status = await offerContract.getStatus();
    ui.write(`Current status: ${status}`);

    await offerContract.sendAcceptOffer(provider.sender(), offerConfig.init.second_coins, offerConfig.init.second_nfts);
}
