import { Address, fromNano } from "@ton/core";
import { NftConfig, NftItem } from "../wrappers/NftItem";
import { randomAddress } from "@ton/test-utils";
import { SandboxContract, SendMessageResult, TreasuryContract } from "@ton/sandbox";
import { OfferContract } from "../wrappers/OfferContract";
import offerConfig from "../config/offer.config";

export function initNfts(count:number = 3, ownerAddress:Address) {
    let index = 1;
    let nftArray: NftConfig[] = [];

    while(index <= count) {
        nftArray.push({
            index,
            collectionAddress: null,
            ownerAddress,
            content: `${ownerAddress.toString()} test-${index}`,
        });

        index++;
    }
    return nftArray;
}

export async function checkNftOnwers(
    user: SandboxContract<TreasuryContract>,
    userNfts:SandboxContract<NftItem>[], 
    offerContract: SandboxContract<OfferContract>,
    messageResult: SendMessageResult
) {
    for(let nftItem of userNfts) {
        expect(messageResult.transactions).toHaveTransaction({
            from: offerContract.address,
            to: nftItem.address,
            success: true
        });

        const nftOnwerAddress = await nftItem.getOwnerAddress();
        expect(nftOnwerAddress.toString()).toBe(user.address.toString());
    }
}

export async function acceptStage(
    nftSecondItems:SandboxContract<NftItem>[], 
    offerContract:SandboxContract<OfferContract>, 
    user:SandboxContract<TreasuryContract>,
    success:boolean = true
) {
    let secondDictNfts:Array<string> = [];
    for(let nftItem of nftSecondItems) {
        secondDictNfts.push(nftItem.address.toString());
    }

    const acceptResult = await offerContract.sendAcceptOffer(user.getSender(), offerConfig.init.second_coins, secondDictNfts);

    if(success) {
        let secondNftIndex = 1;
        for(let nftItem of nftSecondItems) {
            const nftTransferResult = await nftItem.sendTransfer(user.getSender(), {
                newOwner: offerContract.address,
            });
    
            expect(nftTransferResult.transactions).toHaveTransaction({
                from: user.address,
                to: nftItem.address,
                success: true,
            });
    
            expect((await nftItem.getOwnerAddress()).toString()).toBe(offerContract.address.toString());
    
            let secondDictItem = await offerContract.getUserNftAddressFromDict(secondNftIndex);
            expect(secondDictItem.toString()).toBe(nftItem.address.toString());
            secondNftIndex++;
        }

        expect(+fromNano(await offerContract.getBalance())).toBeCloseTo(
            (offerConfig.init.first_coins + offerConfig.totalFee) + (offerConfig.init.second_coins + offerConfig.totalFee),
            0.1
        );

        expect(await offerContract.getStatus()).toBe(offerConfig.status.WAIT_CONFIRM);
    }
    else {
        expect(acceptResult.transactions).toHaveTransaction({
            from: user.address,
            to: offerContract.address,
            success: false,
            exitCode: offerConfig.error.INVALID_ADDRESS,
        });
    }

    return acceptResult;
}