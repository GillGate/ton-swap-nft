import { Address, beginCell, Cell, contractAddress, Dictionary, toNano } from "@ton/core";
import { hex } from "../build/OfferContract.compiled.json";
import { NetworkProvider } from "@ton/blueprint";
import offerConfig from "../config/offer.config";

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

function createDict(nftList:Array<string>) { // helper
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

function offerContractConfigToCell(config: OfferContractConfig): Cell { // helper
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

// Фомирование данных для будущей сделки

const forTxFee = 1; // TON Blockchain fee, depends on nft count 1 TON ~ 10 NFT per each
const serviceFee = 1; // TON Service
const totalFee = forTxFee  + serviceFee;

const offerDataConfig:OfferContractConfig = {
    status: 1,
    first_address: Address.parse("0QAM5Dur_4FN13ubHj50jVhvoJ22_WOimUMJMinq1ODCFrmD"), // заглушка, подставить TonConnect wallet address
    first_coins: toNano(0), // Монеты пользователя
    first_nfts: [
        // набор адресов NFT первого пользователя
    ],
    second_address: null, // пока неизвестно
    second_coins: 0, // пока неизвестно
    second_nfts: null, // пока неизвестно
    service_storage: {
        admin_address: Address.parse("0QAM5Dur_4FN13ubHj50jVhvoJ22_WOimUMJMinq1ODCFrmD"),
        service_address1: Address.parse("0QAM5Dur_4FN13ubHj50jVhvoJ22_WOimUMJMinq1ODCFrmD"), // заглушка
        service_address2: Address.parse("0QAM5Dur_4FN13ubHj50jVhvoJ22_WOimUMJMinq1ODCFrmD") // заглушка
    }
}

let nftAddresses: any[] = [];

function getContractAddress(): Address {
    const code = Cell.fromBoc(Buffer.from(hex, "hex"))[0];
    const data = offerContractConfigToCell(offerDataConfig);

    return contractAddress(0, { code, data });
}

const offerAddress = getContractAddress();

// Формирование сообщений для подписи пользователя

const second_coins = 0;
const second_nfts = createDict(nftAddresses);
const transactions = {
    validUntil: Math.floor(Date.now() / 1000) + 60 * 5, // 5 min
    messages: [
        {
            address: offerAddress,
            amount: `${toNano(second_coins + totalFee)}`,
            payload: beginCell()
                        .storeUint(offerConfig.op.ACCEPT_OFFER, 32)
                        .storeCoins(toNano(second_coins + totalFee))
                        .storeDict(second_nfts)
                    .endCell().toBoc().toString('base64')
        },
        {
            address: "user 2 nft address 1",
            amount: toNano(0.05),
            payload: BuildTransferNftBody({
                newOwner: offerAddress,
            }).toBoc().toString('base64')
        },
        {
            address: "user 2 nft address 2",
            amount: toNano(0.05),
            payload: BuildTransferNftBody({
                newOwner: offerAddress,
            }).toBoc().toString('base64')
        },
        //... | лимит на 4 сообщения у v4r2, 255 сообщений у кошелька w5
    ]
}

// onClick => tonConnectUI.sendTranscation(transactions) ...