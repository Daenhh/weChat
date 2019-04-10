var port = 5050;
var http = require('http');
var https = require('https');
var qs = require('querystring');
var fs = require('fs');
var TOKEN = 'Midstereo';
var read_end = false;
var code = "";
var XMLJS = require('xml2js');
var parser = new XMLJS.Parser();
var builder = new XMLJS.Builder();
var access_token = "";
var APPID = "";  	//微信公众号APPID
var SECRET = "";	//微信公众号SECRET
var weiappAPPID = "";	//微信小程序APPID

function check(params, token){
    var key = [token, params.timestamp, params.nonce].sort().join('');
    var sha1 = require('crypto').createHash('sha1');
    sha1.update(key);
    return sha1.digest('hex') === params.signature;
}

var server = http.createServer(function(request, response){
    var query = require('url').parse(request.url).query;
    var params = qs.parse(query);
    //console.log(params);
    //console.log("token:", TOKEN);

    if(request.method === 'GET'){
		if(!check(params, TOKEN)){
			response.end("signature fail");
			return ;
		}
		response.end(params.echostr);
		//console.log(params.echostr);
	}
	else if(request.method === 'POST'){
		var data = '';
		request.addListener('data', function(chunk){
			data += chunk;
		})
		request.addListener('end', function(){
			//console.log(data);
  			if(data.substr(0, 1) === '{'){
				var post = eval('(' + data + ')');
				console.log(post);
				getQRcode(post.seconds, post.scene_id);
				var timer = setInterval(function(){
					if(read_end){
						fs.readFile('../QRcode.jpg', function(err, data){
							if(err){
								response.status(500);
								console.log("error");
								return response.end("error")
							}
							response.end(data);
						})
						clearInterval(timer);
					}
				}, 100);
			}
			else{
				parser.parseString(data.toString(), function(err, result){
					var body = result.xml;
					//var messageType = body.MsgType;
					console.log(body);
					//var xml = {xml: {
						//ToUserName: body.FromUserName,
						//FromUserName: body.ToUserName,
						//CreateTime: + new Date(),
						//MsgType: 'text',
						//Content: 'hello world'
					//}};
					//xml = builder.buildObject(xml);
					var scene = body.EventKey.toString();
					console.log(scene)
					var contents = "<a data-miniprogram-appid=" + weiappAPPID + " data-miniprogram-path=\"pages/welcome/welcome?scene=" + scene + "\"> Click for Vision Screening </a>"
					console.log(contents);
					response.end("");
					var send_data = JSON.stringify({
						touser: body.FromUserName.toString(),
						//"msgtype": "miniprogrampage",
						//"miniprogrampage": {
							//"title": "Eye Check",
							//"appid": 'wxab4e848bef0d7870',
							//"pagepath": "pages/welcome/welcome",
							//"thumb_media_id": "1";
						//}
						msgtype: "text",
						text: {
							content: contents
						}
					});
					console.log(send_data);
					var option = {
						host: "api.weixin.qq.com",
						path: "/cgi-bin/message/custom/send?access_token=" + access_token,
						method: 'POST',
						headers:{
							'Content-Type': 'application/json',
							'Content-Length': send_data.length
						}
					}
					var req = https.request(option, function (res) {
						//console.log('STATUS: ' + res.statusCode);
						//console.log('HEADERS: ' + JSON.stringify(res.headers));
						res.setEncoding('utf8')
						res.on('data', function (data) {
							//code += data;
							console.log(data);
						})
						res.on('end', function(){})
					});
					req.write(send_data);
					req.on('error', function(e){
						console.log(e);
					})
					req.end()
				})
			}
		})
	}
});
server.listen(port, function(){
	console.log('Server listen at port: ' + port);
})

function getQRcode(seconds, id) {
	//-----------------------get access_token----------------------
	var token_data = qs.stringify({
		grant_type: "client_credential",
		appid: APPID,
		secret: SECRET,
	});

	var token_options = {
		hostname: "api.weixin.qq.com",
		port: 443,
		path: "/cgi-bin/token?" + token_data,
		method: 'GET'
	};

	var token_req = https.request(token_options, function (res) {
		//console.log('STATUS: ' + res.statusCode);
		//console.log('HEADERS: ' + JSON.stringify(res.headers));
		res.setEncoding('utf8');
		res.on('data', function (chunk) {
			var chunk_obj = eval('(' + chunk + ')');
			//console.log("access_token: " + chunk_obj.access_token);
			access_token = chunk_obj.access_token;
			//-------------------------get ticket--------------------------
			var ticket_data = JSON.stringify({
				expire_seconds: seconds,
				action_name: "QR_SCENE",
				action_info: {
					scene: {
						scene_id: id
					}
				}
			});
			
			var ticket_options = {
				host: "api.weixin.qq.com",
				path: "/cgi-bin/qrcode/create?access_token=" + chunk_obj.access_token,
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Content-Length': ticket_data.length
				}
			}

			var ticket_req = https.request(ticket_options, function (res) {
				res.setEncoding('utf8');
				res.on('data', function (data) {
					var data_obj = eval('(' + data + ')');
					//console.log("ticket: " + data_obj.ticket);

					//------------------------get QR code----------------------------
					var code_options = {
						hostname: "mp.weixin.qq.com",
						port: 443,
						path: "/cgi-bin/showqrcode?ticket=" + data_obj.ticket,
						method: 'GET'
					}

					var code_req = https.request(code_options, function (res) {
						//console.log('STATUS: ' + res.statusCode);
						//console.log('HEADERS: ' + JSON.stringify(res.headers));
						res.setEncoding('binary');
						res.on('data', function (data) {
							code += data;
							//console.log(data);
						})
						res.on('end', function(){
							console.log("QRcode");
							fs.writeFile("../QRcode.jpg", code, "binary", function(err) {
								console.log(err);
								return;
							});
							read_end = true;
						})
					})

					code_req.on('error', function (e) {
						console.log("proble with request: " + e.message);
					})
					code_req.end();
				})
			});

			ticket_req.write(ticket_data + "\n");
			ticket_req.end();
		})
	});

	token_req.on('error', function (e) {
		console.log("problem with request: " + e.message);
	});

	token_req.end();
}
