# Account Abstraction + ZK : Semaphore 4337 Wallet

Experiment on building 4337 smart contract wallet controlled by Semaphore Group. This repo contains the optimistic validation method explained in the blog.

Read blog post [here](https://saleel.xyz/blog/zk-account-abstraction/)

Building on top of sample contracts from [account-abstraction](https://github.com/eth-infinitism/account-abstraction)

## Testing

1. Checkout [eth-infinitism/bundler](https://github.com/eth-infinitism/bundler) and follow instructions to run geth, deploy EntryPoint and run the bundler.

2. Run `yarn test` which will run the `tests/e2e.ts` - it deploys the factory, wallet contract, and test some transfers.

Note: the test don't cover the case when Semaphore group root is changed and the cached value in contract is outdated.


### Disclaimer

The code here should only be considered as a reference implementation. It can contain bugs, and is NOT supposed to be used for production use-cases.

