const LendsbayToken = artifacts.require("./LendsbayToken.sol");
const LendsbayPreICOTest = artifacts.require("./LendsbayPreICOTest.sol");
const preIcoSupply = 5 * 1000000 * (10 ** 18);
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
            preIcoSupply
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

    it("should have proper stage token amount", async function () {
        var tokens = 0;
        tokens += ((await preico.tokensPresale()).toNumber());
        tokens += ((await preico.tokensWeek1()).toNumber());
        tokens += ((await preico.tokensWeek2()).toNumber());
        tokens += ((await preico.tokensWeek3()).toNumber());
        tokens += ((await preico.tokensWeek4()).toNumber());
        tokens += ((await preico.tokensWeek5()).toNumber());
        tokens += ((await preico.tokensWeek6()).toNumber());
        assert.equal(tokens, preIcoSupply,
                     "Stage sum isn't equal to initial supply");
    });

    it("should not allow to buy tokens from non-whitelisted buyer", async function () {
        try {
            await preico.sendTransaction({
                from: buyer,
                to: preico.address,
                value: web3.toWei(1)
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

    it("should properly count token limits for presale", async function () {
        await preico.addToWhitelist(buyer);
        const original = await preico.tokensPresale();
        await preico.sendTransaction({
            from: buyer,
            to: preico.address,
            value: web3.toWei(1, 'ether')
        });

        // Now check the balance of buyer
        const balance = await token.balanceOf(buyer);
        let bought = (await preico.RATE_PRESALE()) * (10 ** 18);
        assert.equal(balance.valueOf(), bought,
                    "Invalid token amount for buyer");

        // Check remaining tokens
        const remaining = await preico.getRemainingTokens();
        assert.equal(remaining.valueOf(),
                     original.valueOf() - bought,
                     "Contract didn't subtract tokens");
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

    it("should properly get token amount for all stages", async function () {
        const tokens = [
            (await preico.tokensPresale()).valueOf(),
            (await preico.tokensWeek1()).valueOf(),
            (await preico.tokensWeek2()).valueOf(),
            (await preico.tokensWeek3()).valueOf(),
            (await preico.tokensWeek4()).valueOf(),
            (await preico.tokensWeek5()).valueOf(),
            (await preico.tokensWeek6()).valueOf(),
            0                   // Closed
        ];
        for (var i = 0; i < tokens.length; i++) {
            await setWeek(i);
            assert.equal(
                tokens[i], (await preico.getRemainingTokens()).valueOf(),
                `tokens count doesn't match expected for week ${i}`
            );
        }
    });

    // Now the big things

    it("should properly process buying tokens for each stage", async function () {
        // We need bignumber here to prevent calculation problems
        const tokens = [
            await preico.tokensPresale(),
            await preico.tokensWeek1(),
            await preico.tokensWeek2(),
            await preico.tokensWeek3(),
            await preico.tokensWeek4(),
            await preico.tokensWeek5(),
            await preico.tokensWeek6(),
        ];

        // Rates for each stage
        const rates = [
            (await preico.RATE_PRESALE()).valueOf(),
            (await preico.RATE_WEEK1()).valueOf(),
            (await preico.RATE_WEEK2()).valueOf(),
            (await preico.RATE_WEEK3()).valueOf(),
            (await preico.RATE_WEEK4()).valueOf(),
            (await preico.RATE_WEEK5()).valueOf(),
            (await preico.RATE_WEEK6()).valueOf(),
        ];

        // Adding our buyer to whitelist
        await preico.addToWhitelist(buyer);

        // Now buy them
        let balance = 0;
        for (var i = 0; i < tokens.length; i++) {
            await setWeek(i);
            await preico.sendTransaction({
                from: buyer,
                to: preico.address,
                value: web3.toWei(1, 'ether')
            });
            // Bought tokens on this stage
            const bought = rates[i] * 1 * (10 ** 18);
            balance += bought;  // Calculating without usage of contract

            // Check balance
            const buyerTokens = await token.balanceOf(buyer);
            assert.equal(buyerTokens.valueOf(), balance,
                         `buyer balance doesn't match for stage ${i}`);

            // Check remaining
            const remainingAtThisStage = await preico.getRemainingTokens();
            assert.equal(
                remainingAtThisStage.valueOf(), tokens[i].minus(bought),
                `remaining tokens count doesn't match for stage ${i}`
            );
        }
        // Check that preico contract actually transferred proper
        // amount of tokens
        assert.equal(
            preIcoSupply - (await token.balanceOf(buyer)),
            await token.balanceOf(preico.address),
            "preico contract has wrong balance after buying run"
        );
    });

});
