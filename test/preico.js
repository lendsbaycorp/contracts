var LendsbayToken = artifacts.require("./LendsbayToken.sol");
var LendsbayPreICO = artifacts.require("./LendsbayPreICO.sol");

var preIcoSupply = 5 * 1000000 * (10 ** 18);


contract('LendsbayPreICO', function (accounts) {
    let token = null;
    let preico = null;
    const owner = accounts[0];
    const fund = accounts[1];
    const buyer = accounts[2];

    beforeEach('token and Pre-ICO setup', async function () {
        token = await LendsbayToken.new();
        preico = await LendsbayPreICO.new(
            new Date(2018, 6, 20, 0, 0, 0).getTime() / 1000,
            fund,
            token.address,
            500 * 10 ** 18
        );
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
        assert.equal(tokens * (10 ** 18), preIcoSupply,
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
        await preico.sendTransaction({
            from: buyer,
            to: preico.address,
            value: web3.toWei(1)
        });
    });

});
