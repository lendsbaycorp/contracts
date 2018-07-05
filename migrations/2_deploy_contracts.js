var LendsbayToken = artifacts.require("./LendsbayToken.sol");

module.exports = async function (deployer, network, accounts) {
    const token_owner = accounts[0];
    await deployer.deploy(LendsbayToken, {
        from: token_owner, overwrite: false
    });
    let token = await LendsbayToken.deployed();
    console.log('Token deployed at: ' + token.address);
};
