var LendsbayToken = artifacts.require("./LendsbayToken.sol");

var expectedDecimals = 18;
var expectedSupply = 100 * 1000000 * (10 ** expectedDecimals);
var expectedName = "Lendsbay Token";
var expectedSymbol = "LBT";

contract('LendsbayToken', function (accounts) {
    let token = null;
    const owner = accounts[0];

    beforeEach('token setup', async function () {
        token = await LendsbayToken.new();
    });

    it("should check token total supply", async function () {
        const supply = await token.totalSupply();
        assert.equal(supply.valueOf(), expectedSupply,
                     "Supply isn't same as expected");
    });

    it("should check token decimals", async function () {
        const decimals = await token.decimals();
        assert.equal(decimals.valueOf(), expectedDecimals,
                     "Token decimals value isn't same as expected");
    });

    it("should check token name and symbol", async function () {
        const name = await token.name();
        const symbol = await token.symbol();
        assert.equal(name.valueOf(), expectedName,
                     "Token has wrong name");
        assert.equal(symbol.valueOf(), expectedSymbol,
                     "Token has wrong symbol");
    });

    it("should have all supply on owner account", async function () {
        const balance = await token.balanceOf(owner);

        assert.equal(balance.valueOf(), expectedSupply,
                     `Owner doesn't own ${expectedSupply}`);
    });

    it("should have transfer tokens correctly", async function () {
        const receiver = accounts[1];
        const senderBalance = expectedSupply;
        const amount = 100 * 18;

        // Check initial receiver balance
        let receiverBalance = await token.balanceOf(receiver);
        assert.equal(receiverBalance.valueOf(), 0, "Receiver already has tokens");

        // Now transfer them and check balances
        await token.transfer(receiver, amount, {from: owner});
        let newBalance = await token.balanceOf(receiver);
        assert.equal(newBalance.valueOf(), amount,
                     `Receiver doesn't have ${amount} tokens`);
    });
});
