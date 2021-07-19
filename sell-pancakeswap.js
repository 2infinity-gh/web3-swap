//// How to use: npm sell-pancakeswap.js <FROM_TOKEN_CONTRACT_ADDRESS> <TO_TOKEN_CONTRACT_ADDRESS> <AMOUNT_TO_SWAP>
//// update my-keys.json with you walletaddress & privatekey and bscscan APIkey
//// get an APIkey for bscscan from here https://bscscan.com/apis

const fetch = require("node-fetch");
var fs = require('fs')
var Tx = require('ethereumjs-tx').Transaction;
var Web3 = require('web3')
var Common = require('ethereumjs-common').default;

var myKeys = JSON.parse(fs.readFileSync("my-keys.json", 'utf-8'));

var web3 = new Web3(new Web3.providers.HttpProvider(myKeys.providerURL)) // mainnet: https://bsc-dataseed1.binance.org:443
var BSC_FORK = Common.forCustomChain(
                'mainnet',{
              name: 'bnb',
              networkId: myKeys.networdID, //mainnet: 56
              chainId: myKeys.chainID //mainnet: 56
            },
            'petersburg'
          );

/////////////////// get Contract Abi Functie //////////////////
async function getContractABI(x){
	let tokenWantedAPI = "https://api-testnet.bscscan.com/api?module=contract&action=getabi&address="+x+"&apikey=" +myKeys.bscScanApiKey;

        try {
          const res = await fetch(tokenWantedAPI);
          const headerDate = res.headers && res.headers.get('date') ? res.headers.get('date') : 'no response date';
          console.log('Status Code:', res.status);
          console.log('Date in Response header:', headerDate);
          let users = await res.json();
          contractABI =JSON.parse(users.result);

          return contractABI
        } catch (err) {
          	console.log(err.message); //can be console.error
        }
}



var fromToken = process.argv[2];
var toToken = process.argv[3];
var amountToExchange = process.argv[4];
var Account = web3.eth.accounts.privateKeyToAccount(myKeys.privateKey);
const pancakeSwapRouterAddress = myKeys.pancakeSwapRouterAddress; // mainnet = '0x10ed43c718714eb63d5aa57b78b54704e256024e';
const pancakeSwapFactoryAddress = myKeys.pancakeSwapFactoryAddress; // mainnet = "0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73";
const BNBTokenAddress = myKeys.BNBTokenAddress; // mainnet = "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c" ;
const BUSDTokenAddress  = myKeys.BUSDTokenAddress; //BUSD mainnet = "0xe9e7cea3dedca5984780bafc599bd69add087d56"
const routerAbi = JSON.parse(fs.readFileSync('pancake-router-abi.json', 'utf-8'));
const routerContract = new web3.eth.Contract(routerAbi, pancakeSwapRouterAddress, {from: myKeys.address});
const factoryAbi = JSON.parse(fs.readFileSync('pancake-factory-abi.json', 'utf-8'));
const factoryContract = new web3.eth.Contract(factoryAbi, pancakeSwapFactoryAddress, {from: myKeys.address});
const genTokenAbi = JSON.parse(fs.readFileSync('general-token-abi.json', 'utf-8'));
const toTokenContract = new web3.eth.Contract(genTokenAbi, toToken, {from: myKeys.address});
var myKeys = JSON.parse(fs.readFileSync('my-account.json', 'utf-8'));	


web3.eth.getGasPrice().then(gasPrice => {
   //console.log('Gas Price = ' + gasPrice);
   const gPrice = gasPrice;
});

/////////////////// Get latest block Functie ///////////
async function getLatestBlock(){
  let blockArray = await web3.eth.getBlock("latest");
  return blockArray;
}

/////////////////// CalcSell Functie //////////////////
async function calcSell( tokensToSell, tokenAddress, tokenAbi){
    let tokenRouter = await new web3.eth.Contract( tokenAbi, tokenAddress );
    let tokenDecimals = await tokenRouter.methods.decimals().call();
    
    tokensToSell = setDecimals(tokensToSell, tokenDecimals);
    let amountOut;
    try {
        let router = await new web3.eth.Contract( routerAbi, pancakeSwapRouterAddress );
        amountOut = await router.methods.getAmountsOut(tokensToSell, [tokenAddress ,BNBTokenAddress]).call();
        amountOut =  web3.utils.fromWei(amountOut[1]);
    } catch (error) {}
    
    if(!amountOut) return 0;
    return amountOut;
}

/////////////////// Calc BNBPrice Functie //////////////////
async function calcBNBPrice(){
    let bnbToSell = web3.utils.toWei("1", "ether") ;
    let amountOut;
    try {
        let router = await new web3.eth.Contract( routerAbi, pancakeSwapRouterAddress );
        amountOut = await router.methods.getAmountsOut(bnbToSell, [BNBTokenAddress ,BUSDTokenAddress]).call();
        amountOut =  web3.utils.fromWei(amountOut[1]);
    } catch (error) {}
    if(!amountOut) return 0;
    return amountOut;
}

/////////////////// set decimals functie //////////////////
function setDecimals( number, decimals ){
    number = number.toString();
    let numberAbs = number.split('.')[0]
    let numberDecimals = number.split('.')[1] ? number.split('.')[1] : '';
    while( numberDecimals.length < decimals ){
        numberDecimals += "0";
    }
    return numberAbs + numberDecimals;
}






(async () => {
	var genTokenAbi = JSON.parse(fs.readFileSync('general-token-abi.json', 'utf-8'));
    let bnbPrice = await calcBNBPrice();
    console.log(`CURRENT BNB PRICE: ${bnbPrice}`);
    let priceInBnb = await calcSell(1000, fromToken,genTokenAbi)/1000; // calculate TOKEN price in BNB, sometimes setting only 1 instead of 1000 cause errors
    console.log( 'TOKEN VALUE IN BNB : ' + priceInBnb + ' | Just convert it to USD ' );
    console.log(`TOKEN VALUE IN USD: ${priceInBnb*bnbPrice}`); // convert the token price from BNB to USD based on the retrived BNB value
})();

startSwap();

async function startSwap() {
		let block = await getLatestBlock();
		console.log("Gas Limit:"+block.gasLimit/block.transactions.length);
		const gLimit = block.gasLimit/block.transactions.length;

        
        let res = sellToken(Account, amountToExchange)
            .catch(e => {
                console.error("Error in sell:", e);
                process.exit(1);
            });
        console.log(res);
        await sleep(10000 + Math.random().toFixed(4)*10000);
}

async function sellToken(targetAccount, amount) {
	let fromTokenAbi = await getContractABI(fromToken);
    let privateKey = Buffer.from(targetAccount.privateKey.slice(2), 'hex')  ;
    let fromTokenContract = new web3.eth.Contract(fromTokenAbi, fromToken, {from: targetAccount.address});
	let fromTokenSymbol = await fromTokenContract.methods.symbol().call();
	let fromTokenDec = await fromTokenContract.methods.decimals().call();
    let tokenAmount = setDecimals(amount, fromTokenDec);
	let amountToSell = web3.utils.toBN(web3.utils.toHex(tokenAmount));
	
	console.log('Swapping '+amount+' '+fromTokenSymbol+' with '+fromTokenDec+' decimals for BNB to pancakeswap for address '+Account.address);
	
	// Approve Token spend
    let approveTokenSpendData = fromTokenContract.methods.approve(pancakeSwapRouterAddress, amountToSell);
	
	// Get count of approve transaction
    let count = await web3.eth.getTransactionCount(targetAccount.address);

	
    let rawTransactionApprove = {
        "from":targetAccount.address,
        "gasPrice":web3.utils.toHex(10000000000),
        "gasLimit":web3.utils.toHex(100000),
        "to":fromToken,
        "value":"0x0",
        "data":approveTokenSpendData.encodeABI(),
        "nonce":web3.utils.toHex(count)
    };
    let transactionApprove = new Tx(rawTransactionApprove, {'common':BSC_FORK});
    transactionApprove.sign(privateKey)

    let resultApprove = await web3.eth.sendSignedTransaction('0x' + transactionApprove.serialize().toString('hex'));
	let gasPrice = 10000000000;
	let gasLimit = 2900000;
	if(toToken != BNBTokenAddress && fromToken != BNBTokenAddress){
		var amountOut = await routerContract.methods.getAmountsOut(amountToSell,[fromToken,BNBTokenAddress,toToken]).call();
		amountOut =  web3.utils.fromWei(amountOut[2]);
	}
	else{
		var amountOut = await routerContract.methods.getAmountsOut(amountToSell,[fromToken,toToken]).call();
		amountOut =  web3.utils.fromWei(amountOut[1]);
	}
	
	/////// Get decimals and symbol of output token ////////////////
	let toTokenDec = await toTokenContract.methods.decimals().call();
	let toTokenSymbol = await toTokenContract.methods.symbol().call();
	
	////// Convert amount out with the correct decimals ////
	let amountOutMin = setDecimals(amountOut.toString(), toTokenDec);
	console.log("You will receive: "+amountOut/( 1 ** toTokenDec)+' '+toTokenSymbol);
	
	
	count = await web3.eth.getTransactionCount(targetAccount.address);
	/////////////////////// Check which methode to use /////////////////////
	if(fromToken == BNBTokenAddress){
		var data = routerContract.methods.swapExactETHForTokensSupportingFeeOnTransferTokens(
			web3.utils.toBN(amountOutMin.toString()),
			[fromToken,toToken],
			targetAccount.address,
			web3.utils.toHex(Math.round(Date.now()/1000)+60*20),
		);
		var rawTransaction = {
			"from":targetAccount.address,
			"gasPrice":web3.utils.toHex(gasPrice),
			"gasLimit":web3.utils.toHex(gasLimit),
			"to":pancakeSwapRouterAddress,
			"value":web3.utils.toHex(amountToSell),
			"data":data.encodeABI(),
			"nonce":web3.utils.toHex(count)
		};
	}
	else if(toToken == BNBTokenAddress){
		var data = routerContract.methods.swapExactTokensForETHSupportingFeeOnTransferTokens(
			amountToSell,
			web3.utils.toBN(amountOutMin.toString()),
			[fromToken,toToken],
			targetAccount.address,
			web3.utils.toHex(Math.round(Date.now()/1000)+60*20),
		);
		var rawTransaction = {
			"from":targetAccount.address,
			"gasPrice":web3.utils.toHex(gasPrice),
			"gasLimit":web3.utils.toHex(gasLimit),
			"to":pancakeSwapRouterAddress,
			"value":web3.utils.toHex(0),
			"data":data.encodeABI(),
			"nonce":web3.utils.toHex(count)
		};
	}
	else if(toToken != BNBTokenAddress && fromToken != BNBTokenAddress){
		var data = routerContract.methods.swapExactTokensForTokens(
			amountToSell,
			web3.utils.toBN(amountOutMin.toString()),
			[fromToken,BNBTokenAddress,toToken],
			targetAccount.address,
			web3.utils.toHex(Math.round(Date.now()/1000)+60*20),
		);
		var rawTransaction = {
			"from":targetAccount.address,
			"gasPrice":web3.utils.toHex(gasPrice),
			"gasLimit":web3.utils.toHex(gasLimit),
			"to":pancakeSwapRouterAddress,
			"value":web3.utils.toHex(0),
			"data":data.encodeABI(),
			"nonce":web3.utils.toHex(count)
		};
	}
    


    var transaction = new Tx(rawTransaction, { 'common': BSC_FORK });
    transaction.sign(privateKey);

    var result = await web3.eth.sendSignedTransaction('0x' + transaction.serialize().toString('hex'));
	//console.log(result);	
	console.log("tx: "+result.transactionHash);
    return result;
	
}

function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
} 

