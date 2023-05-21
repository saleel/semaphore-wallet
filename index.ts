import { Wallet } from "ethers";
import { wrapProvider } from "../bundler/packages/sdk/src/Provider";
import { JsonRpcProvider } from "@ethersproject/providers";
import { BytesLike, formatEther, parseEther } from "ethers/lib/utils";
import {
  SimpleAccount__factory,
} from "../account-abstraction/contracts/dist";
import {
  ERC1967Proxy__factory,
  EntryPoint__factory,
} from "../account-abstraction/typechain";

(async () => {
  const provider = new JsonRpcProvider();
  const ethersSigner = provider.getSigner(0);
  const balance = await provider.getCode(
    "0xfe684bb6fad8b6ed97491a37e29b4461d567bd97"
  );

  console.log(balance);

  const config = {
    entryPointAddress: "0x5ff137d4b0fdcd49dca30c7cf57e578a026d2789",
    bundlerUrl: "http://127.0.0.1:3000/rpc",
  };

  const aaProvider = await wrapProvider(provider, config);

  const implementation = await new SimpleAccount__factory(ethersSigner).deploy(
    config.entryPointAddress
  );
  const proxy = await new ERC1967Proxy__factory(ethersSigner).deploy(
    implementation.address,
    "0x"
  );
  const account = SimpleAccount__factory.connect(proxy.address, ethersSigner);

  // const api = new SimpleAccountAPI({
  //   entryPointAddress: "0x5ff137d4b0fdcd49dca30c7cf57e578a026d2789",
  //   provider,
  //   factoryAddress: "0xfe684bb6fad8b6ed97491a37e29b4461d567bd97",
  //   owner: aaProvider.getSigner(),
  // });

  console.log(account.address);

  await ethersSigner.sendTransaction({
    to: account.address,
    value: parseEther("1"),
  });

  const callGasLimit = 200000;
  const verificationGasLimit = 100000;
  const maxFeePerGas = 3e9;

  const op = {
    sender: account.address,
    nonce: 0,
    initCode: "0x",
    callData: await account.interface.encodeFunctionData("execute", [
      "0xCbcAC0388501E5317304D7Da1Ee3a082Df67336d",
      parseEther("0.5"),
      "0x",
    ]),
    callGasLimit,
    verificationGasLimit, // default verification gas. will add create2 cost (3200+200*length) if initCode exists
    preVerificationGas: 2100000, // should also cover calldata cost.
    maxFeePerGas,
    maxPriorityFeePerGas: 1e9,
    paymasterAndData: "0x",
    signature:
      "0x090a62f68e77562bc5e4c7b6516501ab880bca089de55297497eddfd8ef13c6c632bba9e6d890fa051ed8efc8c1c30fe0567ace038c3064ad758160beba513281b",
  };

  console.log(op);

  const res = await aaProvider.httpRpcClient.sendUserOpToBundler(op);

  console.log(
    formatEther(
      await provider.getBalance("0xCbcAC0388501E5317304D7Da1Ee3a082Df67336d")
    )
  );
})();
