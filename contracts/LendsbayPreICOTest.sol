pragma solidity ^0.4.23;

import "./LendsbayPreICO.sol";

/* 
   Mock contract for testing time-related functions properly.
   
   Sadly, using evm_increaseTime or other methods couldn't provide
   good testing environment, because they affects every test in single
   run. So, to stop tests being non-repeateble and hackish, we decided
   to use mock Pre-ICO contract that can receive current time.

   There is pretty small amount of additional code, so we could think
   that contracts are almost same for testing.
*/

contract LendsbayPreICOTest is LendsbayPreICO {

    uint public mockTime = now;

    /* Just pass everything to parent */
    constructor(
        uint256 _startTime,
        address _wallet,
        LendsbayToken _token,
        uint256 _softCap
        ) public
        LendsbayPreICO(_startTime, _wallet, _token, _softCap)
    {
        mockTime = now;
    }

    function getCurrentTime() public view returns (uint) {
        return mockTime;
    }

    function setCurrentTime(uint time) public {
        mockTime = time;
    }
}
