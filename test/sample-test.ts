import { expect } from "chai";
import { ethers, run } from "hardhat";
import { BigNumber, BigNumberish, BytesLike } from "ethers";
import { Identity } from "@semaphore-protocol/identity";
import { Group } from "@semaphore-protocol/group";
import {
  ERC1967Proxy__factory,
  SemaphoreAccount,
  SemaphoreAccount__factory,
  Semaphore,
  SemaphoreAccountFactory,
  SemaphoreAccountFactory__factory,
} from "../types";
import {
  AbiCoder,
  arrayify,
  concat,
  defaultAbiCoder,
  keccak256,
  parseEther,
} from "ethers/lib/utils";
import { generateProof } from "@semaphore-protocol/proof";

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
  let accounts: string[];
  let account: SemaphoreAccount;
  let userOp: UserOperation;
  let userOpHash: string;
  let preBalance: number;
  let expectedPay: number;
  let semaphoreContract: Semaphore;

  const actualGasPrice = 1e9;
  // for testing directly validateUserOp, we initialize the account with EOA as entryPoint.
  let entryPointEoa: string;

  const wasmFilePath = `snark-artifacts/semaphore.wasm`;
  const zkeyFilePath = `snark-artifacts/semaphore.zkey`;

  before(async () => {
    accounts = await ethers.provider.listAccounts();
    const ethersSigner = await ethers.getSigner(accounts[0]);

    ({ semaphore: semaphoreContract } = (await run("deploy:semaphore")) as {
      semaphore: Semaphore;
    });

    entryPointEoa = accounts[2];
    const epAsSigner = await ethers.getSigner(entryPointEoa);

    const factoryContract = await new SemaphoreAccountFactory__factory(
      ethersSigner
    ).deploy(entryPointEoa, semaphoreContract.address);

    const add = await factoryContract.getAddress(accounts[3], 2023, 100);

    await factoryContract.createAccount(accounts[3], 2023, 100);

    account = SemaphoreAccount__factory.connect(add, epAsSigner);

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
  });

  it("should verify signature for valid semaphore proof", async () => {
    // Generate new semaphore identity
    const identity = new Identity();

    // Create new semaphore on-chain group
    const groupId = 2023;
    await semaphoreContract["createGroup(uint256,uint256,address)"](
      groupId,
      20, // tree depth
      accounts[0]
    );

    // Add member to semaphore group on-chain
    await semaphoreContract.addMember(2023, identity.commitment);

    // Construct a local copy of same group
    const group = new Group(groupId, 20, [identity.commitment]);

    // Generate proof of membership
    const userOpHash = "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";
    const externalNullifier = 0; // Not needed
    const signal = userOpHash; // Hash of UserOperation is the signal

    const fullProof = await generateProof(
      identity,
      group,
      externalNullifier,
      signal,
      {
        wasmFilePath,
        zkeyFilePath,
      }
    );
    console.log("merkleTreeRoot", fullProof.merkleTreeRoot);
    console.log("fullProof", fullProof);

    const signature = defaultAbiCoder.encode(
      ["uint256[8]", "uint256"],
      [fullProof.proof, fullProof.nullifierHash]
    );

    const returnValue = await account.callStatic.validateUserOp(
      { ...userOp, nonce: 1, signature },
      userOpHash.toString(),
      0
    );

    expect(returnValue.toNumber()).to.eq(0);
  });
});
