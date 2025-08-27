import { Address, beginCell, Cell, Contract, contractAddress, ContractProvider, Sender, SendMode, toNano } from '@ton/core';

export type NftConfig = {
    index: number,
    collectionAddress: Address | null,
    ownerAddress: Address,
    content: string
};

export type nftTransferOptions = {
    queryId?: number
    newOwner: Address
    responseTo?: Address
    forwardAmount?: bigint
    forwardPayload?: Cell
};

export function mainConfigToCell(config: NftConfig): Cell {
    return beginCell()
        .storeUint(config.index, 64)
        .storeAddress(config.collectionAddress)
        .storeAddress(config.ownerAddress)
        .storeRef(
            beginCell()
                .storeBuffer(Buffer.from(config.content))
            .endCell()
        )
    .endCell();
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

export class NftItem implements Contract {
    constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell }) {}

    static createFromAddress(address: Address) {
        return new NftItem(address);
    }

    static createFromConfig(config: NftConfig, code: Cell, workchain = 0) {
        const data = mainConfigToCell(config);
        const init = { code, data };
        return new NftItem(contractAddress(workchain, init), init);
    }

    async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().endCell(),
        });
    }

    async sendTransfer(provider: ContractProvider, via: Sender, options: nftTransferOptions) {
        await provider.internal(via, {
            value: toNano('0.05'),
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: BuildTransferNftBody(options)
        });
    }

    async getOwnerAddress(provider: ContractProvider) {
        const { stack } = await provider.get("get_nft_data", []);

        stack.readNumber();
        stack.readNumber();
        stack.readAddressOpt();

        return stack.readAddress();
    }
}
