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

    mapping (address => uint256) public presale;

    /* Token price rates */
    uint256 public constant RATE_PRESALE = 2007;
    uint256 public constant RATE_WEEK1 = 1820;
    uint256 public constant RATE_WEEK2 = 1727;
    uint256 public constant RATE_WEEK3 = 1633;
    uint256 public constant RATE_WEEK4 = 1563;
    uint256 public constant RATE_WEEK5 = 1493;
    uint256 public constant RATE_WEEK6 = 1423;

    uint256 public raised = 0;

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

    uint256 public softCap;     /* Amount of eth while it can be refunded */
    uint256 public startTime;   /* Start of Pre-ICO, although presale is allowed */

    event WhitelistAdd(address _address);
    event WhitelistRemove(address _address);

    constructor(
        uint256 _startTime,
        address _wallet,
        LendsbayToken _token,
        uint256 _softCap
        ) public
        Crowdsale(RATE_PRESALE, _wallet, _token)
        RefundableCrowdsale(_softCap)
        TimedCrowdsale(now + 600, _startTime + 6 weeks)
    {
        softCap = _softCap;
        startTime = _startTime;
    }

    /* Will be overriden for tests */
    function getCurrentTime() public view returns (uint) {
        return now;
    }

    function getCurrentStage() public view returns (Stage) {
        for (uint i = 0; i < uint(Stage.Finished); i++) {
            if (getCurrentTime() <= startTime.add(i * 1 weeks)) {
                return Stage(i);
            }
        }
        return Stage.Finished;
    }

    function getCurrentRate() public view returns (uint256) {
        Stage currentStage = getCurrentStage();
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

   /* Overriding Zeppelin's Crowdsale to calculate current price */
    function _getTokenAmount(uint256 _weiAmount) internal view returns (uint256) {
        return tokensForWei(msg.sender, _weiAmount);
    }

    modifier onlyWhileOpen {
        require(getCurrentTime() <= closingTime);
        _;
    }
   
    function hasClosed() public view returns (bool) {
        return getCurrentTime() > closingTime;
    }

    function inWhitelist(address _beneficiary) public view returns (bool) {
        return whitelist[_beneficiary];
    }

    function addToWhitelist(address _beneficiary) external onlyOwner {
        whitelist[_beneficiary] = true;
        emit WhitelistAdd(_beneficiary);
    }

    function removeFromWhitelist(address _beneficiary) external onlyOwner {
        whitelist[_beneficiary] = false;
        emit WhitelistRemove(_beneficiary);
    }


    function tokensForWei(address _buyer, uint256 _weiAmount) internal view returns (uint256) {
        uint256 rate_ = getCurrentRate();
        if (rate_ != RATE_PRESALE && presale[_buyer] > 0) {
            uint256 presoldWei = _weiAmount;
            if (presale[_buyer] < presoldWei) {
                presoldWei = presale[_buyer];
            }
            uint256 bought = RATE_PRESALE.mul(presoldWei);
            
            if (_weiAmount > presoldWei) {
                bought = bought.add(rate_.mul(_weiAmount - presoldWei));
            }
            return bought;
        }
        return rate_.mul(_weiAmount);
    }

    function _updatePurchasingState(address _beneficiary, uint256 _weiAmount) internal {
        if (presale[_beneficiary] > 0) {
            if (presale[_beneficiary] > _weiAmount) {
                presale[_beneficiary] = presale[msg.sender].sub(_weiAmount);
            } else {
                presale[_beneficiary] = 0;
            }
        }
    }

    function addToPresale(address _buyer, uint256 _wei) external onlyOwner {
        presale[_buyer] = _wei;
    }

    function removeFromPresale(address _buyer) external onlyOwner {
        presale[_buyer] = 0;
    }

    function presaleAmount(address _buyer) public view returns (uint256) {
        return presale[_buyer];
    }

    function giveTokens(address _buyer, uint256 _tokens) external onlyOwner {
        _deliverTokens(_buyer, _tokens);
    }

    function setRaised(uint256 _wei) external onlyOwner {
        raised = _wei;
    }

    function goalReached() public view returns (bool) {
        return (raised + weiRaised) >= goal;
    }
}
