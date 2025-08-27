import { Address, beginCell, Cell, Contract, contractAddress, ContractProvider, Dictionary, DictionaryValue, Sender, SendMode, toNano, TupleBuilder } from '@ton/core';
import { randomAddress } from '@ton/test-utils';
import { fromNano } from 'ton';
import offerConfig from '../config/offer.config';
import { NftItem } from './NftItem';

export type ServiceCell = {
    admin_address: Address,
    service_address1: Address,
    service_address2: Address
}

export type OfferContractConfig = {
    status: number,
    first_address: Address,
    first_coins: bigint | 0,
    first_nfts: Array<string>,
    second_address: Address | null,
    second_coins: bigint | 0,
    second_nfts: Array<string> | null,
    service_storage: ServiceCell
};

export type nftTransferOptions = {
    queryId?: number
    newOwner: Address
    responseTo?: Address
    forwardAmount?: bigint
    forwardPayload?: Cell
};

export function createDict(nftList:Array<string>) {
    const dict = Dictionary.empty(Dictionary.Keys.Uint(32), Dictionary.Values.Address());

    nftList.forEach((address, index) => {
        try {
            let nftAddress = Address.parse(address);
            dict.set(++index, nftAddress);
        }
        catch(e) {
            throw(e);
        }
    });

    return dict;
}

export function BuildTransferNftBody(params: nftTransferOptions): Cell {
    const msgBody = beginCell()
    msgBody.storeUint(0x5fcc3d14, 32)
    msgBody.storeUint(params.queryId || 0, 64)
    msgBody.storeAddress(params.newOwner)
    msgBody.storeAddress(params.responseTo || null)
    msgBody.storeBit(false) // no custom payload
    msgBody.storeCoins(params.forwardAmount || 0)
  
    if (params.forwardPayload) {
      // msgBody.storeBit(1)
      msgBody.storeBuilder(params.forwardPayload.asBuilder())
    } else {
      msgBody.storeBit(0) // no forward_payload yet
    }
  
    return msgBody.endCell()
}

export function offerContractConfigToCell(config: OfferContractConfig): Cell {
    const first_nfts = createDict(config.first_nfts);
    const second_nfts =  Dictionary.empty();

    return beginCell()
        .storeUint(config.status, 16)
        .storeAddress(config.first_address)
        .storeCoins(config.first_coins)
        .storeDict(first_nfts)
        .storeAddress(config.second_address)
        .storeCoins(config.second_coins)
        .storeDict(second_nfts)
        .storeRef(
            beginCell()
                .storeAddress(config.service_storage.admin_address)
                .storeAddress(config.service_storage.service_address1)
                .storeAddress(config.service_storage.service_address2)
            .endCell()
        )
    .endCell();
}

export class OfferContract implements Contract {
    constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell }) {}

    static createFromAddress(address: Address) {
        return new OfferContract(address);
    }

    static createFromConfig(config: OfferContractConfig, code: Cell, workchain = 0) {
        const data = offerContractConfigToCell(config);
        const init = { code, data };
        return new OfferContract(contractAddress(workchain, init), init);
    }

    async sendDeploy(provider: ContractProvider, via: Sender, firstCoins: number) {
        await provider.internal(via, {
            value: toNano(firstCoins + offerConfig.totalFee),
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().endCell(),
        });
    }

    async sendCancelOffer(provider: ContractProvider, via: Sender) {
        await provider.internal(via, {
            value: toNano('0.05'),
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell()
                .storeUint(offerConfig.op.CANCEL_OFFER, 32) // op code
            .endCell(),
        });
    }

    async sendAcceptOffer(provider: ContractProvider, via: Sender, secondCoins: number, secondNfts:Array<string>) {
        const dict = createDict(secondNfts);

        await provider.internal(via, {
            value: toNano(secondCoins + offerConfig.totalFee),
            sendMode: SendMode.NONE,
            body: beginCell()
                .storeUint(offerConfig.op.ACCEPT_OFFER, 32)
                .storeCoins(toNano(secondCoins))
                .storeDict(dict)
            .endCell(),
        });
    }

    async sendConfirmOffer(provider: ContractProvider, via: Sender) {
        await provider.internal(via, {
            value: toNano('0.05'),
            sendMode: SendMode.NONE,
            body: beginCell()
                .storeUint(offerConfig.op.CONFIRM_OFFER, 32)
            .endCell(),
        });
    }

    async getStatus(provider: ContractProvider) {
        const { stack } = await provider.get("get_status", []);
        return stack.readNumber();
    }

    async getBalance(provider: ContractProvider) : Promise<number> {
        const { stack } = await provider.get('get_smc_balance', []);
        return stack.readNumber();
    }

    async getCreatorNftAddressFromDict(provider: ContractProvider, index: number) {
        let args = new TupleBuilder();
        args.writeNumber(index);

        const { stack } = await provider.get('get_creator_nft_address_by_index', args.build());
        return stack.readAddress();
    }

    async getUserNftAddressFromDict(provider: ContractProvider, index: number) {
        let args = new TupleBuilder();
        args.writeNumber(index);

        const { stack } = await provider.get('get_user_nft_address_by_index', args.build());
        return stack.readAddress();
    }
}
