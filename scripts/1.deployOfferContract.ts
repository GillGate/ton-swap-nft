import { NetworkProvider } from '@ton/blueprint';
import offerConfig from '../config/offer.config';
import { getOfferContract } from './utils';

export async function run(provider: NetworkProvider) {
    const offerContract = getOfferContract(provider);

    await offerContract.sendDeploy(provider.sender(), offerConfig.init.first_coins);

    await provider.waitForDeploy(offerContract.address);
}
