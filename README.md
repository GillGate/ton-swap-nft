# ton-swap-nft
A smart contract for the TON blockchain, which acts as a guarantor for NFT exchanges between users

Example of a smart contract in action: https://testnet.tonviewer.com/kQCYQl4tfbzE3FzBZ0PQXcG2BRKXvcXkIA5HBSdtdAEZtpmW \
Visual representation of smart contract logic: https://figma.com/board/yHvSyOAmaZj6pahrX5fKDI/NFT-Swapper-idea

## Op-codes:

Op-code: 1 - **Cancel** offer by *first/second user* \
Msg body: \
&emsp;  - Uint32: 1 - Op-code

If success - status change to **0**, deal **cancelled**

---

Op-code: 2 - Send coins by *second user* and **accept** deal \
Msg body: \
&emsp; - Uint32: 2 - Op-code \
&emsp; - Coins: 0|n - Coins amount from second user

If success - status change to **2**, deal **accepted** by *second user*

---

Op-code: 3 - Confirm deal by first user \
Msg body: \
&emsp; - Uint32: 3 - Op-code

If *first user* **cancel** deal - status change to **0**, deal **cancelled** \
If *first user* **confirm** deal - status change to **3**, deal **completed** 

## Get-methods

`get_smc_balance():int` - Find out the current balance of the smart contract \
`get_status():int` - Find out the current status of the smart contract \

`get_creator_address():slice` - Find out creator's address \
`get_creator_coins():int` - Find out creator's amount of coins \
`get_creator_nft_address_by_index(int index):slice`- Get NFT address in dict by index from creator 

`get_user_address():slice` - Find out second user's address \
`get_user_coins():int` - Find out second user's amount of coins \
`get_user_nft_address_by_index(int index):slice` - Get NFT address in dict by index from second user 

Lists of possible `exit codes` can be found in `config/offer.config.ts`