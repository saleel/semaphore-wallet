import { expect } from "chai";
import { ethers } from "hardhat";
import { BigNumberish, BytesLike } from "ethers";
import {
  ERC1967Proxy__factory,
  SemaphoreAccount,
  SemaphoreAccount__factory,
} from "../types";
import { defaultAbiCoder, keccak256, parseEther } from "ethers/lib/utils";

interface UserOperation {
  sender: string;
  nonce: BigNumberish;
  initCode: BytesLike;
  callData: BytesLike;
  callGasLimit: BigNumberish;
  verificationGasLimit: BigNumberish;
  preVerificationGas: BigNumberish;
  maxFeePerGas: BigNumberish;
  maxPriorityFeePerGas: BigNumberish;
  paymasterAndData: BytesLike;
  signature: BytesLike;
}

function packUserOp(op: UserOperation, forSignature = true): string {
  if (forSignature) {
    return defaultAbiCoder.encode(
      [
        "address",
        "uint256",
        "bytes32",
        "bytes32",
        "uint256",
        "uint256",
        "uint256",
        "uint256",
        "uint256",
        "bytes32",
      ],
      [
        op.sender,
        op.nonce,
        keccak256(op.initCode),
        keccak256(op.callData),
        op.callGasLimit,
        op.verificationGasLimit,
        op.preVerificationGas,
        op.maxFeePerGas,
        op.maxPriorityFeePerGas,
        keccak256(op.paymasterAndData),
      ]
    );
  } else {
    // for the purpose of calculating gas cost encode also signature (and no keccak of bytes)
    return defaultAbiCoder.encode(
      [
        "address",
        "uint256",
        "bytes",
        "bytes",
        "uint256",
        "uint256",
        "uint256",
        "uint256",
        "uint256",
        "bytes",
        "bytes",
      ],
      [
        op.sender,
        op.nonce,
        op.initCode,
        op.callData,
        op.callGasLimit,
        op.verificationGasLimit,
        op.preVerificationGas,
        op.maxFeePerGas,
        op.maxPriorityFeePerGas,
        op.paymasterAndData,
        op.signature,
      ]
    );
  }
}

function getUserOpHash(
  op: UserOperation,
  entryPoint: string,
  chainId: number
): string {
  const userOpHash = keccak256(packUserOp(op, true));
  const enc = defaultAbiCoder.encode(
    ["bytes32", "address", "uint256"],
    [userOpHash, entryPoint, chainId]
  );
  return keccak256(enc);
}

// describe("Greeter", function () {
//   it("Should return the new greeting once it's changed", async function () {

//     const SemaphoreAccont

//   const implementation = await new SimpleAccount__factory(ethersSigner).deploy(
//     config.entryPointAddress
//   );
//   const proxy = await new ERC1967Proxy__factory(ethersSigner).deploy(
//     implementation.address,
//     "0x"
//   );
//   const account = SimpleAccount__factory.connect(proxy.address, ethersSigner);

//     const Greeter = await ethers.getContractFactory("Greeter");
//     const greeter = await Greeter.deploy("Hello, world!");
//     await greeter.deployed();

//     expect(await greeter.greet()).to.equal("Hello, world!");

//     const setGreetingTx = await greeter.setGreeting("Hola, mundo!");

//     // wait until the transaction is mined
//     await setGreetingTx.wait();

//     expect(await greeter.greet()).to.equal("Hola, mundo!");
//   });
// });

describe("#validateUserOp", () => {
  let account: SemaphoreAccount;
  let userOp: UserOperation;
  let userOpHash: string;
  let preBalance: number;
  let expectedPay: number;

  const actualGasPrice = 1e9;
  // for testing directly validateUserOp, we initialize the account with EOA as entryPoint.
  let entryPointEoa: string;

  before(async () => {
    const accounts = await ethers.provider.listAccounts();
    const ethersSigner = await ethers.getSigner(accounts[0]);

    entryPointEoa = accounts[2];
    const epAsSigner = await ethers.getSigner(entryPointEoa);

    // cant use "SimpleAccountFactory", since it attempts to increment nonce first
    const implementation = await new SemaphoreAccount__factory(
      ethersSigner
    ).deploy(entryPointEoa);
    const proxy = await new ERC1967Proxy__factory(ethersSigner).deploy(
      implementation.address,
      "0x"
    );
    account = SemaphoreAccount__factory.connect(proxy.address, epAsSigner);

    await ethersSigner.sendTransaction({
      from: accounts[0],
      to: account.address,
      value: parseEther("0.2"),
    });
    const callGasLimit = 200000;
    const verificationGasLimit = 100000;
    const maxFeePerGas = 3e9;
    const chainId = await ethers.provider
      .getNetwork()
      .then((net) => net.chainId);

    userOp = {
      sender: account.address,
      nonce: 0,
      initCode: "0x",
      callData: "0x",
      callGasLimit,
      verificationGasLimit,
      maxFeePerGas,
      preVerificationGas: 21000, // should also cover calldata cost.
      maxPriorityFeePerGas: 1e9,
      paymasterAndData: "0x",
      signature: "0x",
    };

    userOpHash = await getUserOpHash(userOp, entryPointEoa, chainId);

    expectedPay = actualGasPrice * (callGasLimit + verificationGasLimit);

    preBalance = parseInt(
      (await ethers.provider.getBalance(account.address)).toString()
    );

    const ret = await account.validateUserOp(userOp, userOpHash, expectedPay, {
      gasPrice: actualGasPrice,
    });

    await ret.wait();
  });

  it("should return NO_SIG_VALIDATION on wrong signature", async () => {
    const userOpHash = ethers.constants.HashZero;
    const returnValue = await account.callStatic.validateUserOp(
      { ...userOp, nonce: 1, signature: '0x01' },
      userOpHash,
      0
    );

    expect(returnValue.toNumber()).to.eq(1);
  });
});
