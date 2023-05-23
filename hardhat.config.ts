import '@typechain/hardhat';
import "@nomiclabs/hardhat-ethers";
// import "@semaphore-protocol/hardhat"
import "./tasks/deploy-semaphore"
import "./tasks/deploy-semaphore-verifier"

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task("accounts", "Prints the list of accounts", async (taskArgs, hre) => {
  const accounts = await hre.ethers.getSigners();

  for (const account of accounts) {
    console.log(account.address);
  }
});

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  // Allow 0.8.4 and above
  solidity: {
    compilers: [
      {
        version: "0.8.4",
        settings: {},
      },
      {
        version: "0.8.17",
        settings: {},
      }
    ]
  },
  typechain: {
    outDir: 'types',
    target: 'ethers-v5'
  },
};
