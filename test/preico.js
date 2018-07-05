const BigNumber = require('bignumber.js');
const LendsbayToken = artifacts.require("./LendsbayToken.sol");
const LendsbayPreICOTest = artifacts.require("./LendsbayPreICOTest.sol");
const preIcoSupply = 5 * 1000000 * (10 ** 18);
const softCap = web3.toWei(2, 'ether'); // Small softcap for testing
const DAY = 3600 * 24;


contract('LendsbayPreICO', function (accounts) {
    let token = null;
    let preico = null;
    let vault = null;
    let startTime = null;
    const owner = accounts[0];
    const fund = accounts[1];
    const buyer = accounts[2];

    // Helper to set preico current time (to the last second of range actually)
    const setWeek = async (i) => {
        await preico.setCurrentTime(startTime + 7 * DAY * i);
    };

    beforeEach('token and Pre-ICO setup', async function () {
        token = await LendsbayToken.new();
        // Set start date as next week
        startTime = Math.floor(new Date().getTime() / 1000) + 7 * DAY;
        preico = await LendsbayPreICOTest.new(
            startTime,
            fund,
            token.address,
            softCap
        );
        vault = await preico.vault(); // Refund vault
        // Allocate tokens to preico contract
        await token.transfer(preico.address, preIcoSupply, {from: owner});
    });

    it("should have initial amount of tokens on contract", async function () {
        const tokens = await token.balanceOf(preico.address);
        assert.equal(tokens.valueOf(), preIcoSupply,
                     "Initial amount isn't same as expected");
    });

    it("should not allow to buy tokens from non-whitelisted buyer", async function () {
        try {
            await preico.sendTransaction({
                from: buyer,
                to: preico.address,
                value: web3.toWei(1, 'ether')
            });
            assert(false, "Transaction must fail");
        } catch (error) {
            if (error.toString().indexOf('revert') === -1)
                assert(false, "Transation must throw revert");
        }
    });

    it("should add buyer to whitelist", async function () {
        await preico.addToWhitelist(buyer);
        const inList = await preico.whitelist(buyer);
        assert.isTrue(inList, "Buyer isn't in whitelist");
    });

    it("should allow to buy tokens from whitelisted buyer", async function () {
        await preico.addToWhitelist(buyer);
        let sent = web3.toWei(1, 'ether')
        await preico.sendTransaction({
            from: buyer,
            to: preico.address,
            value: sent
        });
        let preicoBalance = await web3.eth.getBalance(vault);
        assert.equal(sent,
                     preicoBalance.valueOf(),
                     "Preico vault balance is wrong");
    });

    it("should properly move through stages", async function () {
        const getStage = async () => {
            return (await preico.getCurrentStage()).valueOf();
        };
        assert.equal(await getStage(), 0, "presale stage works wrong");

        // I hope I didn't miss something. This is tiresome.
        
        const middleWeek = async (week) => {
            // Calculating 3rd day of week, -1 is to make usage clearer
            await preico.setCurrentTime(
                startTime + 7 * DAY * (week - 1) + 3 * DAY
            );
        };
        // 7 stages, from 1 to 6 week plus finalization
        for (var i = 1; i <= 7; i++) {
            await middleWeek(i);
            assert.equal(await getStage(), i, `stage ${i} doesn't work`);
        }
    });


    it("should properly get prices for all stages", async function () {
        const rates = [
            (await preico.RATE_PRESALE()).valueOf(),
            (await preico.RATE_WEEK1()).valueOf(),
            (await preico.RATE_WEEK2()).valueOf(),
            (await preico.RATE_WEEK3()).valueOf(),
            (await preico.RATE_WEEK4()).valueOf(),
            (await preico.RATE_WEEK5()).valueOf(),
            (await preico.RATE_WEEK6()).valueOf(),
            0                   // Closed
        ];
        for (var i = 0; i < rates.length; i++) {
            await setWeek(i);
            assert.equal(
                rates[i], (await preico.getCurrentRate()).valueOf(),
                `price doesn't match expected for week ${i}`
            );
        }
    });

    // Now the big things

    it("should properly process buying tokens for each stage", async function () {
        // We need bignumber here to prevent calculation problems

        // Rates for each stage
        const rates = [
            await preico.RATE_PRESALE(),
            await preico.RATE_WEEK1(),
            await preico.RATE_WEEK2(),
            await preico.RATE_WEEK3(),
            await preico.RATE_WEEK4(),
            await preico.RATE_WEEK5(),
            await preico.RATE_WEEK6(),
        ];

        // Adding our buyer to whitelist
        await preico.addToWhitelist(buyer);

        // Now buy them
        let balance = 0;
        for (var i = 0; i < rates.length; i++) {
            await setWeek(i);
            await preico.sendTransaction({
                from: buyer,
                to: preico.address,
                value: web3.toWei(1, 'ether')
            });
            // Bought tokens on this stage
            const bought = rates[i].times(10 ** 18);
            balance = bought.plus(balance);  // Calculating without usage of contract

            // Check balance
            const buyerTokens = await token.balanceOf(buyer);
            assert.equal(buyerTokens.valueOf(), balance,
                         `buyer balance doesn't match for stage ${i}`);
        }
        // Check that preico contract actually transferred proper
        // amount of tokens
        const icoAmount = new BigNumber(preIcoSupply)
              .minus(await token.balanceOf(buyer));
        assert.equal(
            icoAmount.valueOf(),
            (await token.balanceOf(preico.address)).valueOf(),
            "preico contract has wrong balance after buying run"
        );
    });

    const massBuy = async function (mul) {
        let buyers = accounts.slice(3);
        let sent = new BigNumber(0);
        // Buy much
        for (let i = 0; i < buyers.length; i++) {
            await preico.addToWhitelist(buyers[i]);
            const sentAmount = web3.toWei(0.1 + mul * i, 'ether');
            sent = sent.plus(new BigNumber(sentAmount));
            await preico.sendTransaction({
                from: buyers[i],
                to: preico.address,
                value: sentAmount
            });
        }
        return sent;
    };

    it("should properly finalize", async function () {
        let sent = await massBuy(0.3);

        // Now check balance first
        assert.equal((await web3.eth.getBalance(vault)).valueOf(),
                     sent.valueOf(),
                     "vault balance doesn't match sent amount of eth");

        // Try to finalize now, must throw
        try {
            await preico.finalize();
            assert(false, "Must not finalize until end time");
        } catch (error) {
            if (error.toString().indexOf('revert') === -1)
                assert(false, "Finalize transation must throw revert");
        }

        // Try to claim refund
        try {
            await preico.claimRefund({from: accounts[4]});
            assert(false, "Must not allow refunds now");
        } catch (error) {
            if (error.toString().indexOf('revert') === -1)
                assert(false, "Refund transation must throw revert");
        }

        // Now wait properly and finalize
        await preico.setCurrentTime(
            startTime + 7 * DAY * 6 + 1
        );

        assert.equal((await preico.goalReached()).valueOf(), true,
                     "goal isn't reached");

        let fundBalance = await web3.eth.getBalance(fund);
        let res = await preico.finalize();

        // Try to claim refund again
        try {
            await preico.claimRefund({from: accounts[4]});
            assert(false, "Must not allow refunds now");
        } catch (error) {
            if (error.toString().indexOf('revert') === -1)
                assert(false, "Refund transation must throw revert");
        }

        assert.equal((await web3.eth.getBalance(vault)).valueOf(), 0,
                     "preico contract still has eth");
        assert.equal((await web3.eth.getBalance(fund)).valueOf(),
                     sent.plus(fundBalance).valueOf(),
                     "fund didn't received eth after finalization");
    });

    it("should allow refunds if cap isn't reached", async function () {
        let sent = await massBuy(0.01);
        let buyerBalance = await web3.eth.getBalance(accounts[4]);

        // Check balances again
        assert.equal((await web3.eth.getBalance(vault)).valueOf(),
                     sent.valueOf(),
                     "vault balance doesn't match sent amount of eth");
        // Now wait properly and finalize
        await preico.setCurrentTime(
            startTime + 7 * DAY * 6 + 1
        );

        assert.equal((await preico.goalReached()).valueOf(), false,
                     "goal is reached");

        await preico.finalize();

        // Not get refund really
        const res = await preico.claimRefund({from: accounts[4]});
        assert.isAbove(await web3.eth.getBalance(accounts[4]).valueOf(),
                       buyerBalance.valueOf(),
                       "refund didn't happen");
    });

    it("should not allow to buy more than supply", async function () {
        // New contract with low supply
        preico = await LendsbayPreICOTest.new(
            startTime,
            fund,
            token.address,
            softCap
        );
        await token.transfer(preico.address, 5000 * (10 ** 18), {from: owner});
        assert.equal((await token.balanceOf(preico.address)).valueOf(),
                     5000 * (10 ** 18),
                     "Initial amount is wrong");

        // Buy small amount first
        await preico.addToWhitelist(buyer);
        await preico.sendTransaction({
            from: buyer,
            to: preico.address,
            value: web3.toWei(1, 'ether')
        });
        // Not buy much more
        try {
            await preico.sendTransaction({
                from: buyer,
                to: preico.address,
                value: web3.toWei(2, 'ether')
            });
            assert(false, "Must not allow buy more tokens now");
        } catch (error) {
            if (error.toString().indexOf('revert') === -1)
                assert(false, "Buy transation must throw revert");
        }
    });

    it("should properly calculate presale", async function () {
        // Get both these guys 
        const buyer2 = accounts[4];
        await preico.addToWhitelist(buyer);
        await preico.addToWhitelist(buyer2);

        await preico.addToPresale(buyer, web3.toWei(2, 'ether'));
        await preico.addToPresale(buyer2, web3.toWei(1, 'ether'));

        await setWeek(1);       // First week - rate already different

        // Buy by buyer
        await preico.sendTransaction({
            from: buyer,
            to: preico.address,
            value: web3.toWei(1, 'ether')
        });
        assert.equal(await preico.presaleAmount(buyer).valueOf(),
                     web3.toWei(1, 'ether'),
                     "presale doesn't counted properly");

        assert.equal((await token.balanceOf(buyer)).valueOf(),
                     web3.toWei(1, 'ether') * (await preico.RATE_PRESALE()),
                     "presale doesn't sent tokens propetly");

        await preico.sendTransaction({
            from: buyer2,
            to: preico.address,
            value: web3.toWei(2, 'ether')
        });

        // console.log((await token.balanceOf(buyer2)).valueOf());
        const expected = (await preico.RATE_PRESALE()) * web3.toWei(1, 'ether')
              + (await preico.getCurrentRate()) * web3.toWei(1, 'ether');
        assert.equal(expected, (await token.balanceOf(buyer2)).valueOf(),
                    "token weren't splitted as expected");
    });

    it("should just give tokens", async function () {
        await preico.addToWhitelist(buyer);
        await preico.giveTokens(buyer, web3.toWei(2, 'ether'));
        console.log((await token.balanceOf(buyer)).valueOf());
    });
});
