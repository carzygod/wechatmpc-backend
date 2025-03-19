/**
 * This controller is to build a api request system for wallet
 */
const root = process.cwd();
require('dotenv').config();
var querystring = require('querystring');
var express = require('express');
const fs = require("fs");
var app = express();
var bodyParser = require('body-parser');
const modules = require("../../modules/index")
const redis = require("../../utils/redis")
const qr = require('qrcode');
const b58 = require("b58")

const auth = require("./middleware/auth");

app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json())

const cors = require('cors');
app.use(cors())

app.listen(50001, async function() {
    console.log('web-server start')
})

async function sendErr(res, err) {
    if (!err) {
        err = "unknow error"
    }
    return await res.status(500).send({
        "code": 500,
        "error": err
    })
}

/**
 * Get
 */

//Ping
app.get('/ping',  async function(req, res) {
    res.status(200).send({
        "code": 200,
        "data": "pong"
    })
})

app.get('/debug',  async function(req, res) {
    res.status(200).redirect("weixin://dl/business/?t=xS9rExPnQvk")
})

app.post('/wechat/login', async function(req, res) {
    return modules.wx.wxLogin(req,res)
})

app.post('/wechat/qr', async function(req, res) {
    return modules.wx.getWxQrcode(req,res)
})

app.post('/wechat/dl', async function(req, res) {
    return modules.wx.getDeeplink(req,res)
})

app.post('/connect', async function(req, res) {
    try{
        const verfi = tgVerfiy(process.env.TELEGRAMAPI, req.body.initData)
        console.log(verfi)
        if (verfi) {
            const rawData = querystring.decode(req.body.initData);
            const userData = JSON.parse(rawData.user)
            const token = await auth.newkey(userData.id)
            console.log(userData.id)
            const wallets = modules.wallet.getAddress(userData.id)
            res.status(200).send({
                "code": 200,
                "token": token,
                "data": {
                    wallets : wallets,
                    userData : userData
                }
            })
        } else {
            await sendErr(res)
        }
    }catch(e)
    {console.error(e);await sendErr(res)}
})

app.post('/action', auth.auth, async function(req, res) {
    const ret = await modules.wallet.action(res.locals.auth,req.body)
    res.status(200).send({
        "code": 200,
        "data": ret
    })
    if(ret)
    {
        setTimeout(
            async function(){
                await redis.delPreconnect(req.body.i)
            },60000
        );
    }
})

app.post('/mpc/action', async function(req, res) {
    console.log("🚧 action/mpc : ",req.body)
    const ret = await modules.wallet.mpc_action(req.body)
    res.status(200).send({
        "code": 200,
        "data": ret
    })
    if(ret)
    {
        setTimeout(
            async function(){
                await redis.delPreconnect(req.body.i)
            },60000
        );
    }
})

app.get('/result/:actionId',async function(req, res) {
    const ret = await redis.getAction(req.params.actionId)
    res.status(200).send({
        "code": 200,
        "data": ret
    })
})

app.get('/preconnect/:actionId',async function(req, res) {
    var ret = await redis.getPreconnect(req.params.actionId)
    if(ret)
        {
           try{
            ret = JSON.parse(
                Buffer.from(
                    b58.decode(ret)
                ).toString()
            )
           }catch(e)
           {
            console.error(e)
           }
        }
    res.status(200).send({
        "code": 200,
        "data": ret
    })
})

app.get('/tokenPrice/aggregator',async function(req, res) {
    const ret = await redis.getStorage("binance_price_oracle")
    try{
        res.status(200).send({
            "code": 200,
            "data": JSON.parse(ret)
        })
    }catch(e)
    {
        sendErr(res,"Internal Oracle Error")
    }
})

app.get('/balance/aggregator',async function(req, res) {
    const ret = await modules.wallet.balanceAggregator(req.query)
    res.status(200).send({
        "code": 200,
        "data": ret
    })
})
/**
 * Post
 */

app.post('/preconnect/:actionId', async function(req, res) {
        console.log(req.params.actionId,req.body)
        try{
            await redis.setPreconnect(req.params.actionId,req.body.data)
            res.status(200).send({
                "code": 200,
                "data": req.params.actionId
            })
            setTimeout(
                async function(){
                    await redis.delPreconnect(req.params.actionId)
                },600000
            );
        }catch(e)
        {
            console.err(e)
        }
})


app.post('/auth', async function(req, res) {
    const verfi = tgVerfiy(process.env.TELEGRAMAPI, req.body.initData)
    console.log(verfi)
    if (verfi) {
        const rawData = querystring.decode(req.body.initData);
        const userData = JSON.parse(rawData.user)
        const token = await auth.newkey(userData.id)
        console.log(userData.id)
        res.status(200).send({
            "code": 200,
            "token": token,
            "data": userData
        })
    } else {
        await sendErr(res)
    }
})

/**
 *Wallet connection logic
 *
 * 1.Dapp generate a random key (32 lenght)
 * 
 * 2.Dapp params key into webapp link 
 * 
 * 3.Dapp loop call api interface with random Key for callback/webhook
 * 
 * 4.User open Webapp with generated link
 * 
 * 5.Tonspack server update information of callback address
 */

const crypto = require("crypto");
const { action } = require('../../modules/wallet');

function tgVerfiy(apiToken, telegramInitData) {
    const initData = new URLSearchParams(telegramInitData);

    initData.sort();

    const hash = initData.get("hash");
    initData.delete("hash");

    const dataToCheck = [...initData.entries()].map(([key, value]) => key + "=" + value).join("\n");

    const secretKey = crypto.createHmac("sha256", "WebAppData").update(apiToken).digest();

    const _hash = crypto.createHmac("sha256", secretKey).update(dataToCheck).digest("hex");

    return hash === _hash;
}

//INIT
async function init() {
    await redis.init()
    modules.wx.ACTokenManager()
}

module.exports = {
    init
}
