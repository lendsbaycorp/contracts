pragma solidity ^0.4.23;

import "./LendsbayToken.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/lifecycle/Pausable.sol";
import "openzeppelin-solidity/contracts/crowdsale/validation/WhitelistedCrowdsale.sol";
import "openzeppelin-solidity/contracts/crowdsale/validation/TimedCrowdsale.sol";
import "openzeppelin-solidity/contracts/crowdsale/distribution/RefundableCrowdsale.sol";

/*
  Pre-ICO crowdsale based on OpenZeppelin's classes.
  Lasts 6 weeks after start with different rate for each week.
  Refundable until the soft cap is reached.
  Can be paused by owner.
*/

contract LendsbayPreICO is RefundableCrowdsale, WhitelistedCrowdsale, Pausable {
    using SafeMath for uint256;

    /* Token price rates */
    uint256 constant RATE_PRESALE = 2006;
    uint256 constant RATE_WEEK1 = 1820;
    uint256 constant RATE_WEEK2 = 1726;
    uint256 constant RATE_WEEK3 = 1633;
    uint256 constant RATE_WEEK4 = 1563;
    uint256 constant RATE_WEEK5 = 1572;
    uint256 constant RATE_WEEK6 = 1423;

    /* Limits of token sales at each period */
    uint256 public tokensPresale = 860000;
    uint256 public tokensWeek1 = 780000;
    uint256 public tokensWeek2 = 740000;
    uint256 public tokensWeek3 = 700000;
    uint256 public tokensWeek4 = 670000;
    uint256 public tokensWeek5 = 674000;
    uint256 public tokensWeek6 = 610000;

    enum Stage {
        Presale,
        Week1,
        Week2,
        Week3,
        Week4,
        Week5,
        Week6,
        Finished
    }

    Stage public currentStage;

    uint256 public softCap;     /* Amount of eth while it can be refunded */
    uint256 public startTime;   /* Start of Pre-ICO, although presale is allowed */

    constructor(
        uint256 _startTime,
        address _wallet,
        LendsbayToken _token,
        uint256 _softCap
        ) public
        Crowdsale(RATE_PRESALE, _wallet, _token)
        RefundableCrowdsale(_softCap)
        TimedCrowdsale(now, _startTime + 6 weeks)
    {
        softCap = _softCap;
        startTime = _startTime;
    }

    function setCurrentStage() internal {
        for (uint i = 0; i < uint(Stage.Finished); i++) {
            if (now <= startTime.add(i * 1 weeks)) {
                currentStage = Stage(i);
                return;
            }
        }
        currentStage = Stage.Finished;
        return;
    }

    function getCurrentRate() internal returns (uint256) {
        if (currentStage == Stage.Presale) {
            return RATE_PRESALE;
        } else if (currentStage == Stage.Week1) {
            return RATE_WEEK1;
        } else if (currentStage == Stage.Week2) {
            return RATE_WEEK2;
        } else if (currentStage == Stage.Week3) {
            return RATE_WEEK3;
        } else if (currentStage == Stage.Week4) {
            return RATE_WEEK4;
        } else if (currentStage == Stage.Week5) {
            return RATE_WEEK5;
        } else if (currentStage == Stage.Week6) {
            return RATE_WEEK6;
        }
        return 0;
    }

    function getRemainingTokens() internal returns (uint256) {
        if (currentStage == Stage.Presale) {
            return tokensPresale;
        } else if (currentStage == Stage.Week1) {
            return tokensWeek1;
        } else if (currentStage == Stage.Week2) {
            return tokensWeek2;
        } else if (currentStage == Stage.Week3) {
            return tokensWeek3;
        } else if (currentStage == Stage.Week4) {
            return tokensWeek4;
        } else if (currentStage == Stage.Week5) {
            return tokensWeek5;
        } else if (currentStage == Stage.Week6) {
            return tokensWeek6;
        }
        return 0;
    }

    function setRemainingTokens(uint256 sold) internal {
        if (currentStage == Stage.Presale) {
            tokensPresale -= sold;
        } else if (currentStage == Stage.Week1) {
            tokensWeek1 -= sold;
        } else if (currentStage == Stage.Week2) {
            tokensWeek2 -= sold;
        } else if (currentStage == Stage.Week3) {
            tokensWeek3 -= sold;
        } else if (currentStage == Stage.Week4) {
            tokensWeek4 -= sold;
        } else if (currentStage == Stage.Week5) {
            tokensWeek5 -= sold;
        } else if (currentStage == Stage.Week6) {
            tokensWeek6 -= sold;
        }
    }

    function tokensForWei(uint256 _weiAmount) internal returns (uint256) {
        uint256 rate_ = getCurrentRate();
        return rate_.mul(_weiAmount);
    }

    /* Overriding Zeppelin's Crowdsale to calculate current price */
    function _getTokenAmount(uint256 _weiAmount) internal view returns (uint256) {
        return tokensForWei(_weiAmount);
    }

    function _preValidatePurchase(address _beneficiary, uint256 _weiAmount) internal {
        super._preValidatePurchase(_beneficiary, _weiAmount);
        setCurrentStage();
        uint256 tokens = tokensForWei(_weiAmount);
        require(tokens >= getRemainingTokens());
    }

    function _updatePurchasingState(address _beneficiary, uint256 _weiAmount) internal {
        setRemainingTokens(tokensForWei(_weiAmount));
    }
}
