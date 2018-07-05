var LendsbayPreICO = artifacts.require("./LendsbayPreICO.sol");
var LendsbayToken = artifacts.require("./LendsbayToken.sol");

const preIcoSupply = 5 * 1000000 * (10 ** 18);
const DAY = 3600 * 24;
const softCap = web3.toWei(500, 'ether'); // FIX
const startTime = 1529308800;

module.exports = async function (deployer, network, accounts) {
    const token_owner = accounts[0];
    const preico_owner = accounts[1];
    const fund = accounts[2];


    let token = null;
    let preico = null;

    deployer.deploy(LendsbayToken, {overwrite: false}).then((tok) => {
        return tok;
    }).then((tok) => {
        token = tok;
        return deployer.deploy(
            LendsbayPreICO,
            startTime,
            fund,
            token.address,
            softCap,
            {from: preico_owner// , overwrite: false
            }
        );
    }).then((instance) => {
        preico = instance;
        return token.transfer(preico.address, preIcoSupply, {from: token_owner});
    }).then(function (result) {
        return token.balanceOf.call(preico.address, {from: token_owner});
    }).then(function (balance) {
        console.log('ICO has ' + balance + ' tokens');
    });
};
