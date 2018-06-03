pragma solidity ^0.4.23;

import "openzeppelin-solidity/contracts/token/ERC20/StandardToken.sol";

/* Pretty common ERC20 token without any additional logic */

contract LendsbayToken is StandardToken {
    /* We don't use detailed ERC20 from openzeppelin for simplicity */
    string public constant name = "Lendsbay Token";
    string public constant symbol = "LBT";
    uint8 public constant decimals = 18;

    constructor() public {
        totalSupply_ = 100 * 1000000 * (10 ** uint256(decimals)); /* 100 mln */
        /* Add everything to lendsbay account */
        balances[msg.sender] = totalSupply();
    }
}
