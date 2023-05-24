require('dotenv').config()
const express = require("express");
const bodyParser = require("body-parser");
const session = require('express-session');
const passport = require('passport');
const passportLocalMongoose = require('passport-local-mongoose');
const app = express();
const mongoose = require("mongoose");
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const findOrCreate = require('mongoose-findorcreate')
const port = 3000;
app.set('view engine', 'ejs');

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

app.use(session({
  secret: 'keyboard cat',
  resave: false,
  saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

main().catch(err => console.log(err));

async function main() {
  await mongoose.connect('mongodb://127.0.0.1:27017/secretsDB');

  const userSchema = new mongoose.Schema ({
    email: String,
    password: String,
    googleId: String,
    secret: String
  });

  userSchema.plugin(passportLocalMongoose);
  userSchema.plugin(findOrCreate);

  const User = new mongoose.model("User", userSchema);

  passport.use(User.createStrategy());

  passport.serializeUser(function(user, cb) {
    process.nextTick(function() {
      cb(null, { id: user.id, username: user.username });
    });
  });
  
  passport.deserializeUser(function(user, cb) {
    process.nextTick(function() {
      return cb(null, user);
    });
  });


  passport.use(new GoogleStrategy({
      clientID: process.env.CLIENT_ID,
      clientSecret: process.env.CLIENT_SECRET,
      callbackURL: "http://localhost:3000/auth/google/Secrets",
      userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo"
    },
    function(accessToken, refreshToken, profile, cb) {
      User.findOrCreate({ googleId: profile.id }, function (err, user) {
        return cb(err, user);
      });
    }
  ));
  
  app.get('/', (req, res) => {
    res.render("home");
  });

  app.get('/auth/google',
  passport.authenticate('google', { scope: ['profile'] }));

  app.get('/auth/google/Secrets', 
  passport.authenticate('google', { failureRedirect: '/login' }),
  function(req, res) {
    // Successful authentication, redirect home.
    res.redirect('/secrets');
  });

  app.get('/login', (req, res) => {
      res.render("login");
  });
  
  app.get('/register', (req, res) => {
      res.render("register");
  });

  app.get('/secrets', (req, res)=>{
    User.find({"secret": {$exists: true}}).then((foundusers)=>{
        if (foundusers) {
          res.render('secrets', {usersWithSecrets: foundusers});
        }
      
    });
  });
  
  app.post('/register', (req, res) => {
    User.register({username: req.body.username}, req.body.password, function (err, user){
      if (err){
        console.log(err);
        res.redirect("/register");
      } else {
        passport.authenticate("local")(req, res, function(){
          res.redirect("/secrets");
        })
      }
    })
  });

  app.post('/login',async function (req, res){
    const user = new User({
      username: req.body.username,
      password: req.body.password
    });
    req.logIn(user, function(err){
      if (err){
        console.log(err);
      } else {
        passport.authenticate("local")(req, res, function(){
          res.redirect("/secrets");
        });
      }
    })
  });

  app.get('/submit', (req, res)=>{
    if (req.isAuthenticated()){
      res.render('submit');
    } else {
      res.redirect('/login');
    }
  });

  app.post('/submit', (req, res)=>{
    const submittedsecret = req.body.secret;
    User.findById(req.user.id).then((currentuser)=>{
      if (currentuser){
        console.log('ok');
        currentuser.secret = submittedsecret;
        currentuser.save();
        res.redirect("/secrets");
      }
    });
  });

  app.get('/logout', (req, res)=> {
    req.logout(function(err) {
      if (err) { return next(err); }
      res.redirect('/');
    });
  });

  app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
  })
  
}