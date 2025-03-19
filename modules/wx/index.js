require('dotenv').config();

let accessToken = ""

function getOpenId(code) {
    return new Promise((resolve, reject) => {
      const url = `https://api.weixin.qq.com/sns/jscode2session?appid=${process.env.APPID}&secret=${process.env.APPSECRET}&js_code=${code}&grant_type=authorization_code`
      fetch(url)
        .then((response) => response.json())
        .then((data) => {
          resolve(data)
        })
        .catch((err) => {
          reject(err)
        })
    })
  }

function ACTokenManager() {
  const url_at = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${process.env.APPID}&secret=${process.env.APPSECRET}`
  function updateToken() {
    fetch(url_at)
      .then((response) => response.json())
      .then((data) => {
        accessToken = data.access_token
      })
      .catch((err) => {
        console.error(err)
      })
  }
  updateToken()
  setInterval(
    () => {
      updateToken()
    },
    1000 * 4 * 60
  )
}

function wxLogin(req, res) {
    const { code } = req.body
    getOpenId(code)
    .then(async (data) => {
      const { openid } = data
    //   console.log(openid)
      res.send(
        {
            code:200,
            uid:openid
        }
      )
    })
    .catch((err) => {
      console.error(err)
      res.status(500).send(err.message)
    })
  }


async function getWxQrcode(req, res) {
 try {
    const qrcode_key = "4k6oagQMoHDshheYKQwarif91CxiRCfEq8GmLUUKUKuBr9eZcr9B5AiNH9pygDUML2ykpw9kD12Nkcb9tJUWrzpTY3V2SpSwBB2hwF4xYdxuheCk1LQB3XkSobSnsPoWgvv6kqWup93m5ELP4ZY5gbJue4AkUxgPjCiTEFKRedNjt7mVvDN2vXanqNeySZzBPDpmJXjvA1wJi1JmSTz9xu5gzJ8";
    const url = `https://api.weixin.qq.com/wxa/getwxacodeunlimit?access_token=${accessToken}`;
    
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        scene: qrcode_key,
        width: 280,
        page: "pages/init/index",
        env_version: "trial",
        // env_version: "release",
        check_path: false
      })
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`微信API返回错误: ${response.status} - ${errorText}`);
    }
    res.setHeader("Access-Control-Expose-Headers", "scene");
    res.setHeader("scene", qrcode_key);
    res.setHeader("Content-Type", "image/png");
    const buffer = await response.arrayBuffer();
    res.send(Buffer.from(buffer));
  } catch (err) {
    console.error("获取微信小程序码出错:", err);
    res.status(500).send(err.message);
  }
}
async function getDeeplink(req, res) {
  try {
     const query = "4k6oagQMoHDshheYKQwarif";
     const url = `https://api.weixin.qq.com/wxa/generatescheme?access_token=${accessToken}`;
     
     const response = await fetch(url, {
       method: "POST",
       headers: {
         "Content-Type": "application/json"
       },
       body: JSON.stringify({
        "jump_wxa":{
          path: "pages/QR/QR",
          query: query,
          env_version: "trial",
        },
        "is_expire":true,
        "expire_type":1,
        "expire_interval":1
       })
     });
     if (!response.ok) {
       const errorText = await response.text();
       throw new Error(`微信API返回错误: ${response.status} - ${errorText}`);
     }
        const ret =  await response.json();
        console.log(
           ret
            )
     res.send(
      ret
     );
   } catch (err) {
     console.error("获取微信小程序码出错:", err);
     res.status(500).send(err.message);
   }
   }
module.exports = {
    wxLogin,
    getWxQrcode,
    ACTokenManager,
    getDeeplink
}