var app = require('express')();
var express = require('express');
var http = require('http').Server(app);
var io = require('socket.io')(http);
var MongoClient = require("mongodb").MongoClient;
var session = require('express-session');
var bodyParser = require('body-parser');
var usernames = {};
var curroom = "default";
var me = "";
var now = new Date();
var annee   = now.getFullYear();
var mois    = ('0'+now.getMonth()+1).slice(-2);
var jour    = ('0'+now.getDate()   ).slice(-2);
var heure   = ('0'+now.getHours()  ).slice(-2);
var minute  = ('0'+now.getMinutes()).slice(-2);
var date = annee + "/" + mois + "/" + jour + "/" + heure + "/" + minute;
app.use(session({secret: 'ssshhhhh'}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));
app.use("/js", express.static(__dirname + "/js"));
app.engine('.html', require('ejs').__express);
app.set('views', '');
app.set('view engine', 'html');
http.listen(3000, function(){
});
app.get('/', function(req, res){
	var sess = req.session;
	if (!sess.name) {
		res.render('index.html');
	}
	else {
		res.redirect('/chat');
	}
});
app.get('/account', function(req, res){
	var sess = req.session;
	if (!sess.name) {
		res.redirect('/');
	}
	else {
		res.render('account.html');
	}
});
app.post('/account', function(req, res){
	var sess = req.session;
	MongoClient.connect("mongodb://localhost:27017/myirc", function(error, db) {
		if (error) return funcCallback(error);
		db.collection("users").find().toArray(function(err, results) {
			results.forEach( function(element, index) {
				if (element.name == req.body.name) {
					res.redirect("/chat");
				}
			});
		});
		db.collection("users").updateOne({name:sess.name},
		{ $set: {
			name:req.body.name, password:req.body.password
		}
	});
	me = req.body.name;
});
	res.redirect("/chat");
});
app.post('/admin', function(req, res){
	var sess = req.session;
	if (!sess.admin) {
		res.redirect('/chat');
	}
	else {
		MongoClient.connect("mongodb://localhost:27017/myirc", function(error, db) {
			if (error) return funcCallback(error);
			db.collection("rooms").updateOne({name:req.body.oldchan},
				{ $set: {
					name:req.body.newchan
				}
			});
		});
		res.redirect('/admin');
	}
});
app.get('/admin', function(req, res){
	var sess = req.session;
	if (!sess.admin) {
		res.redirect('/chat');
	}
	else {
		res.render('admin.html');
	}
});
app.get('/inscription', function(req, res){
	var sess = req.session;
	if (!sess.name) {
		res.render('inscription.html');
	}
	else {
		res.redirect('/chat');
	}
});
app.get("/deconnexion", function(req, res) {
	req.session.destroy();
	res.redirect("/");
});
app.post('/new', function(req, res) {
	MongoClient.connect("mongodb://localhost:27017/myirc", function(error, db) {
		if (error) return funcCallback(error);
		db.collection("users").find().toArray(function(err, results) {
			results.forEach( function(element, index) {
				if (element.name == req.body.name) {
					return false
				}
			});
		});
		db.collection('users').insertOne( {
			"name": req.body.name,
			"password": req.body.password
		});
	});
	res.redirect('/');
});
app.post('/log', function(req, res) {
	MongoClient.connect("mongodb://localhost:27017/myirc", function(error, db) {
		if (error) return funcCallback(error);
		db.collection("users").find().toArray(function(err, results) {
			results.forEach( function(element, index) {
				if (element.name == req.body.name && element.password == req.body.password) {
					var sess = req.session
					sess.name = element.name;
					me = element.name;
					sess.nick = element.name;
					if (element.admin) {
						sess.admin = 1;
					}
				}
			});
			res.redirect('/');
		})
	});
});
app.get('/chat', function(req, res){
	var sess = req.session;
	if (!sess.nick) {
		res.redirect("/");
	}
	res.render('chat.html');
});
io.on('connection', function(socket){
	socket.nickname = me;
	usernames[me] = socket.id;
	socket.room = "default";
	socket.join(socket.room);
	socket.on('chat message', function(msg){
		io.in(socket.room).emit('chat message', socket.nickname + ": " + msg);			
	});
	socket.on('admin message', function(msg){
		MongoClient.connect("mongodb://localhost:27017/myirc", function(error, db) {
			if (error) return funcCallback(error);
			db.collection('logs').insertOne( {
				"name": socket.nickname,
				"msg": msg
			});
		});
		io.emit('chat message', 'Admin' + ": " + msg);			
	});
	socket.on('/nick', function(msg){
		MongoClient.connect("mongodb://localhost:27017/myirc", function(error, db) {
			if (error) return funcCallback(error);
			db.collection('logs').insertOne( {
				"name": socket.nickname,
				"msg": msg
			});
		});
		socket.nickname =  msg.split(" ")[1];
	});
	socket.on('/join', function(msg){
		socket.room =  msg.split(" ")[1];
		var exist = false;
		MongoClient.connect("mongodb://localhost:27017/myirc", function(error, db) {
			if (error) return funcCallback(error);
			db.collection("rooms").find().toArray(function(err, results) {
				db.collection('logs').insertOne( {
					"name": socket.nickname,
					"msg": msg
				});

				results.forEach( function(element, index) {
					if (element.name === socket.room){
						exist = true;
					}
				});
				if (exist === false) {
					db.collection('rooms').insertOne( {
						"name": socket.room,
						"date": date
					});
				}
			})
		});
		socket.join(socket.room);
		io.in(socket.room).emit('chat message', socket.nickname + " join " + socket.room);
	});
	socket.on('/part', function(msg){
		room =  msg.split(" ")[1];
		socket.leave(room);
	});
	socket.on('/users', function(msg){
		for (var socketId in io.sockets.sockets) {
			io.in(socket.room).emit('chat message', io.sockets.sockets[socketId].nickname);
		}
	});
	socket.on('/msg', function(msg){
		var user = msg.split(" ")[1];
		var private = msg.split(" ")[2];
		io.to(usernames[user]).emit('chat message', private);
	});
	socket.on('/list', function(msg){

	});
});
app.get('/index', function(req, res){
	var sess = req.session;
	if (!sess.name) {
		res.render('index.html');
	}
	else {
		res.redirect('/chat');
	}
});
// console.log(date);
