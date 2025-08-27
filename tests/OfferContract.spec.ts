import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { Address, beginCell, Cell, loadTransaction, loadTransactionDescription, Slice, toNano } from '@ton/core';
import { OfferContract, OfferContractConfig } from '../wrappers/OfferContract';
import { NftConfig, NftItem } from '../wrappers/NftItem';
import '@ton/test-utils';
import { compile } from '@ton/blueprint';
import { randomAddress } from '@ton/test-utils';
import { fromNano } from 'ton';
import offerConfig, { forTxFee, serviceFee } from '../config/offer.config';
import { acceptStage, checkNftOnwers, initNfts } from './utils';

import { hex as OfferContractHex } from "../build/OfferContract.compiled.json";
import { hex as nftItemHex } from "../build/NftItem.compiled.json";

describe('OfferContract', () => {
    let offerCode: Cell;
    let nftCode: Cell;

    let blockchain: Blockchain;
    let firstUser: SandboxContract<TreasuryContract>;
    let secondUser: SandboxContract<TreasuryContract>;
    let admin: SandboxContract<TreasuryContract>;
    let wrongUser: SandboxContract<TreasuryContract>;
    let serviceWallet1: SandboxContract<TreasuryContract>;
    let serviceWallet2: SandboxContract<TreasuryContract>;
    let offerContract: SandboxContract<OfferContract>;
    let nftContract: SandboxContract<NftItem>;

    let offerContractConfig:OfferContractConfig = {
        status: 1,
        first_address: randomAddress(),
        first_coins: toNano(offerConfig.init.first_coins),
        first_nfts: [],
        second_address: null,
        second_coins: 0,
        second_nfts: null,
        service_storage: {
            admin_address: randomAddress(),
            service_address1: randomAddress(),
            service_address2: randomAddress()
        }
    }

    let nftFirstItems:SandboxContract<NftItem>[] = [];
    let nftSecondItems:SandboxContract<NftItem>[] = [];

    beforeAll(async () => {
        offerCode = await compile('OfferContract');
        nftCode = await compile('NftItem');

        // offerCode = Cell.fromBoc(Buffer.from(OfferContractHex, "hex"))[0];
        // nftCode = Cell.fromBoc(Buffer.from(nftItemHex, "hex"))[0];
    });

    beforeEach(async () => {
        blockchain = await Blockchain.create();

        firstUser = await blockchain.treasury('first user');
        secondUser = await blockchain.treasury('second user');
        admin = await blockchain.treasury('admin');
        wrongUser = await blockchain.treasury('wrong user');

        serviceWallet1 = await blockchain.treasury('serviceWallet1');
        serviceWallet2 = await blockchain.treasury('serviceWallet2');

        offerContractConfig.first_address = firstUser.address;
        offerContractConfig.service_storage.admin_address = admin.address;
        offerContractConfig.service_storage.service_address1 = serviceWallet1.address;
        offerContractConfig.service_storage.service_address2 = serviceWallet2.address;

        nftFirstItems = [];
        offerContractConfig.first_nfts = [];
        for(let nftConfig of initNfts(3, firstUser.address)) { // max 10 with 0 coins, max 20 with >1 coins from first user
            nftContract = blockchain.openContract(NftItem.createFromConfig(nftConfig, nftCode));
            nftFirstItems.push(nftContract);
            offerContractConfig.first_nfts.push(nftContract.address.toString());
        }

        offerContract = blockchain.openContract(OfferContract.createFromConfig(offerContractConfig, offerCode));
        const deployResult = await offerContract.sendDeploy(firstUser.getSender(), offerConfig.init.first_coins);

        expect(deployResult.transactions).toHaveTransaction({
            from: firstUser.address,
            to: offerContract.address,
            deploy: true,
            success: true,
        });

        let firstNftIndex = 1;
        for(let nftItem of nftFirstItems) {
            const nftTransferResult = await nftItem.sendTransfer(firstUser.getSender(), {
                newOwner: offerContract.address,
            });

            expect(nftTransferResult.transactions).toHaveTransaction({
                from: firstUser.address,
                to: nftItem.address,
                success: true,
            });

            expect((await nftItem.getOwnerAddress()).toString()).toBe(offerContract.address.toString());

            let firstDictItem = await offerContract.getCreatorNftAddressFromDict(firstNftIndex);
            expect(firstDictItem.toString()).toBe(nftItem.address.toString());
            firstNftIndex++;
        }
        
        nftSecondItems = [];
        for(let nftConfig of initNfts(6, secondUser.address)) { // max 10 with 0 coins, max 20 with >1 coins from first user
            nftContract = blockchain.openContract(NftItem.createFromConfig(nftConfig, nftCode));
            nftSecondItems.push(nftContract);
        }
    });

    it('should deploy', async () => {
        console.log("initial values =====================================");
        console.log("smc address", offerContract.address);
        console.log("firstUser address", firstUser.address); // EQDVJV0CrF0VlQ0lJ98zPWoePW0-M5GC9xGCtX52k5byrHwL
        console.log("secondUser address", secondUser.address); // EQDUyein2J_7ygqW-9_mOkg6garOZ1a9-z5lFjmdSpBf_0p6
        console.log("first_nfts", offerContractConfig.first_nfts);
    });

    it("should cancel offer by first user", async () => {
        console.log("test should cancel offer by first user =====================================");

        const initialFirstUserBalance = +fromNano(`${await firstUser.getBalance()}`); 
        const cancelResult = await offerContract.sendCancelOffer(firstUser.getSender());

        const afterCancelFirstUserBalance = +fromNano(`${await firstUser.getBalance()}`); 
        const totalReturnedValue = afterCancelFirstUserBalance - initialFirstUserBalance;

        console.log("total fUser returned balance", totalReturnedValue);
        console.log("contract rest balance", fromNano(await offerContract.getBalance()));

        expect(cancelResult.transactions).toHaveTransaction({
            from: firstUser.address,
            to: offerContract.address,
            success: true
        });

        expect(totalReturnedValue).toBeGreaterThan(offerConfig.init.first_coins + serviceFee);

        await checkNftOnwers(firstUser, nftFirstItems, offerContract, cancelResult);

        expect(await offerContract.getStatus()).toBe(offerConfig.status.OFFER_CANCELED);
    });

    it("shouldn't cancel offer by wrong user", async () => {
        console.log("test shouldn't cancel offer by wrong user =====================================");
        const cancelResult = await offerContract.sendCancelOffer(wrongUser.getSender());

        expect(cancelResult.transactions).toHaveTransaction({
            from: wrongUser.address,
            to: offerContract.address,
            success: false,
            exitCode: offerConfig.error.INVALID_ADDRESS
        });
    });

    it("should cancel offer by second user after accept", async () => {
        console.log("test should cancel offer by second user after accept =====================================");

        // acceppt stage
        await acceptStage(nftSecondItems, offerContract, secondUser);

        // cancel stage
        const initialFirstUserBalance = +fromNano(`${await firstUser.getBalance()}`); 
        const initialSecondUserBalance = +fromNano(`${await secondUser.getBalance()}`); 

        const cancelResult = await offerContract.sendCancelOffer(secondUser.getSender());

        expect(cancelResult.transactions).toHaveTransaction({
            from: secondUser.address,
            to: offerContract.address,
            success: true
        });

        const afterCancelFirstUserBalance = +fromNano(`${await firstUser.getBalance()}`); 
        const afterCancelSecondUserBalance = +fromNano(`${await secondUser.getBalance()}`); 

        const totalFirstReturnedValue = afterCancelFirstUserBalance - initialFirstUserBalance;
        const totaSecondReturnedValue = afterCancelSecondUserBalance - initialSecondUserBalance;

        console.log("total fUser returned balance", totalFirstReturnedValue);
        console.log("total sUser returned balance", totaSecondReturnedValue);
        console.log("contract rest balance", fromNano(await offerContract.getBalance()));

        expect(totalFirstReturnedValue).toBeGreaterThan(offerConfig.init.first_coins);
        expect(totaSecondReturnedValue).toBeGreaterThan(offerConfig.init.second_coins);

        await checkNftOnwers(firstUser, nftFirstItems, offerContract, cancelResult);
        await checkNftOnwers(secondUser, nftSecondItems, offerContract, cancelResult);

        expect(await offerContract.getStatus()).toBe(offerConfig.status.OFFER_CANCELED);
    });

    it("should cancel offer after expired period by admin", async () => {
        console.log("test should cancel offer after expired period by admin =====================================");

        // acceppt stage
        await acceptStage(nftSecondItems, offerContract, secondUser);

        // cancel stage
        const initialFirstUserBalance = +fromNano(`${await firstUser.getBalance()}`); 
        const initialSecondUserBalance = +fromNano(`${await secondUser.getBalance()}`); 

        const cancelResult = await offerContract.sendCancelOffer(admin.getSender());

        expect(cancelResult.transactions).toHaveTransaction({
            from: admin.address,
            to: offerContract.address,
            success: true
        });

        const afterCancelFirstUserBalance = +fromNano(`${await firstUser.getBalance()}`); 
        const afterCancelSecondUserBalance = +fromNano(`${await secondUser.getBalance()}`); 

        const totalFirstReturnedValue = afterCancelFirstUserBalance - initialFirstUserBalance;
        const totaSecondReturnedValue = afterCancelSecondUserBalance - initialSecondUserBalance;

        console.log("total fUser returned balance", totalFirstReturnedValue);
        console.log("total sUser returned balance", totaSecondReturnedValue);
        console.log("contract rest balance", fromNano(await offerContract.getBalance()));

        expect(totalFirstReturnedValue).toBeGreaterThan(offerConfig.init.first_coins);
        expect(totaSecondReturnedValue).toBeGreaterThan(offerConfig.init.second_coins);

        await checkNftOnwers(firstUser, nftFirstItems, offerContract, cancelResult);
        await checkNftOnwers(secondUser, nftSecondItems, offerContract, cancelResult);

        expect(await offerContract.getStatus()).toBe(offerConfig.status.OFFER_CANCELED);
    });

    it("should accept offer by second user", async () => {
        console.log("test should accept offer by second user =====================================");

        // acceppt stage
        await acceptStage(nftSecondItems, offerContract, secondUser);
    });

    it("shouldn't accept offer by first user", async () => {
        console.log("test should accept offer by second user =====================================");

        // acceppt stage
        await acceptStage(nftSecondItems, offerContract, firstUser, false);
    });

    it("should confirm offer by first user", async () => {
        console.log("test should confirm offer by first user =====================================");

        // acceppt stage
        await acceptStage(nftSecondItems, offerContract, secondUser);

        //confirm stage
        const initialFirstUserBalance = +fromNano(`${await firstUser.getBalance()}`); 
        const initialSecondUserBalance = +fromNano(`${await secondUser.getBalance()}`); 

        const initialServiceWallet1Balance = +fromNano(`${await serviceWallet1.getBalance()}`); 
        const initialServiceWallet2Balance = +fromNano(`${await serviceWallet2.getBalance()}`); 

        const confirmResult = await offerContract.sendConfirmOffer(firstUser.getSender());

        expect(confirmResult.transactions).toHaveTransaction({
            from: firstUser.address,
            to: offerContract.address,
            success: true
        });

        const afterConfirmFirstUserBalance = +fromNano(`${await firstUser.getBalance()}`); 
        const afterConfirmSecondUserBalance = +fromNano(`${await secondUser.getBalance()}`); 

        const afterConfirmServiceWallet1Balance = +fromNano(`${await serviceWallet1.getBalance()}`); 
        const afterConfirmServiceWallet2Balance = +fromNano(`${await serviceWallet2.getBalance()}`); 

        const totalFirstGotValue = afterConfirmFirstUserBalance - initialFirstUserBalance;
        const totaSecondGotValue = afterConfirmSecondUserBalance - initialSecondUserBalance;

        const serviceWallet1TotalBalance = afterConfirmServiceWallet1Balance - initialServiceWallet1Balance;
        const serviceWallet2TotalBalance = afterConfirmServiceWallet2Balance - initialServiceWallet2Balance;

        console.log("total fUser returned balance", totalFirstGotValue);
        console.log("total sUser returned balance", totaSecondGotValue);
        console.log("contract rest balance", fromNano(await offerContract.getBalance()));

        expect(totalFirstGotValue).toBeGreaterThan(offerConfig.init.second_coins);
        expect(totaSecondGotValue).toBeGreaterThan(offerConfig.init.first_coins);

        expect(serviceWallet1TotalBalance).toBeCloseTo((serviceFee * 2) * 0.3);
        expect(serviceWallet2TotalBalance).toBeCloseTo((serviceFee * 2) * 0.7);

        await checkNftOnwers(firstUser, nftSecondItems, offerContract, confirmResult);
        await checkNftOnwers(secondUser, nftFirstItems, offerContract, confirmResult);

        expect(await offerContract.getStatus()).toBe(offerConfig.status.OFFER_COMPLETED);
    });

    it("shouldn't confirm offer by wrong user", async () => {
        console.log("test shouldn't confirm offer by wrong user =====================================");

        // acceppt stage
        await acceptStage(nftSecondItems, offerContract, secondUser);

        const confirmResult = await offerContract.sendConfirmOffer(secondUser.getSender());

        expect(confirmResult.transactions).toHaveTransaction({
            from: secondUser.address,
            to: offerContract.address,
            success: false,
            exitCode: offerConfig.error.INVALID_ADDRESS,
        });
    });

    it("shouldn't confirm offer when deal is cancelled", async () => {
        console.log("shouldn't confirm offer when deal is cancelled =====================================");

        const cancelResult = await offerContract.sendCancelOffer(firstUser.getSender());

        expect(cancelResult.transactions).toHaveTransaction({
            from: firstUser.address,
            to: offerContract.address,
            success: true,
        });

        expect(await offerContract.getStatus()).toBe(offerConfig.status.OFFER_CANCELED);

        const confirmResult = await offerContract.sendConfirmOffer(secondUser.getSender());

        expect(confirmResult.transactions).toHaveTransaction({
            from: secondUser.address,
            to: offerContract.address,
            success: false,
            exitCode: offerConfig.error.WRONG_ACTION,
        });
    });
});
