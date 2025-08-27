import { Address, Cell, toNano } from "@ton/core";
import offerConfig from "../config/offer.config";
import { OfferContract } from "../wrappers/OfferContract";
import { hex } from "../build/OfferContract.compiled.json";
import { NetworkProvider } from "@ton/blueprint";

export function getOfferContract(provider:NetworkProvider) {
    const codeCell = Cell.fromBoc(Buffer.from(hex, "hex"))[0];

    return provider.open(OfferContract.createFromConfig({
        status: offerConfig.init.status,
        first_address: Address.parse(offerConfig.init.first_address),
        first_coins: toNano(offerConfig.init.first_coins),
        first_nfts: offerConfig.init.first_nfts,
        second_address: null,
        second_coins: 0,
        second_nfts: null,
        service_storage: {
            admin_address: Address.parse(offerConfig.init.admin_address),
            service_address1: Address.parse(offerConfig.init.serviceAddress1),
            service_address2: Address.parse(offerConfig.init.serviceAddress2)
        }
    }, codeCell));
}