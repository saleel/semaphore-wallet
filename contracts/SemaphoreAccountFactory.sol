// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.12;

import "@openzeppelin/contracts/utils/Create2.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "./SemaphoreAccount.sol";
import "hardhat/console.sol";


contract SemaphoreAccountFactory {
    SemaphoreAccount public immutable accountImplementation;
    address public semaphoreAddress;

    constructor(IEntryPoint _entryPoint, address _semaphoreAddress) {
        accountImplementation = new SemaphoreAccount(_entryPoint);

        semaphoreAddress = _semaphoreAddress;
    }

    function createAccount(
        address owner,
        uint256 groupId,
        uint256 salt
    ) public returns (SemaphoreAccount ret) {
        address addr = getAddress(owner, groupId, salt);
        uint codeSize = addr.code.length;
        if (codeSize > 0) {
            console.log("existing");
            return SemaphoreAccount(payable(addr));
        }
        ret = SemaphoreAccount(
            payable(
                new ERC1967Proxy{salt: bytes32(salt)}(
                    address(accountImplementation),
                    abi.encodeCall(
                        SemaphoreAccount.initialize,
                        (owner, semaphoreAddress, groupId)
                    )
                )
            )
        );
    }

    function getAddress(
        address owner,
        uint256 groupId,
        uint256 salt
    ) public view returns (address) {
        return
            Create2.computeAddress(
                bytes32(salt),
                keccak256(
                    abi.encodePacked(
                        type(ERC1967Proxy).creationCode,
                        abi.encode(
                            address(accountImplementation),
                            abi.encodeCall(
                                SemaphoreAccount.initialize,
                                (owner, semaphoreAddress, groupId)
                            )
                        )
                    )
                )
            );
    }
}
