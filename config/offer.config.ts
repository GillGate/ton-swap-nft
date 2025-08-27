export const forTxFee = 0.5; // TON Blockchain fee, depends on nft count 1 TON ~ 10 NFT per each
export const serviceFee = 0.1; // TON Service

export default {
    totalFee: serviceFee + forTxFee,
    op: {
        CANCEL_OFFER: 1,
        ACCEPT_OFFER: 2,
        CONFIRM_OFFER: 3,
        NFT_TRANSFER: 0x5fcc3d14
    },
    status: {
        OFFER_CANCELED: 0,
        WAIT_SECOND: 1,
        WAIT_CONFIRM: 2,
        OFFER_COMPLETED: 3
    },
    error: {
        WRONG_ACTION: 401,
        INVALID_AMOUNT: 402,
        INVALID_ADDRESS: 403,
        DICT_VALUE_NOT_FOUND: 404,
        DICT_EMPTY: 405,
        UNKNOWN_OP: 0xffffff
    },
    init: {
        status: 1,
        first_address: "0QBX_oJ8xet3pvRJ6JK1GHq9oUiQjct0ohQlgYX1OGopNcOP", // creator address from TonConnect or else
        first_coins: 0.6, // TON
        first_nfts: [
            "kQA5O61oM6sq2r_Hy7ENFZOXFtIKJ9jw-C4E7sDSs4r3BLvA",
        ],
        second_address: "0QC-0_RK1mBAc-DRAn9LHsLNt2NcLB_eNIJ1UicLs63C0ri4",
        second_coins: 1, // TON
        second_nfts: [
            "kQDC6PFPp7L73WzI3EOOUmlE-pD-gZ2ylCmTX9L_TFGBtZar",
        ],
        admin_address:   "0QAM5Dur_4FN13ubHj50jVhvoJ22_WOimUMJMinq1ODCFrmD", // can cancel offer after expired deal period
        serviceAddress1: "0QBX_oJ8xet3pvRJ6JK1GHq9oUiQjct0ohQlgYX1OGopNcOP",
        serviceAddress2: "0QC-0_RK1mBAc-DRAn9LHsLNt2NcLB_eNIJ1UicLs63C0ri4",
    },
}