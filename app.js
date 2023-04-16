require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const session = require('express-session');
const passport = require('passport');
const passportLocal = require('passport-local');
const passportLocalMongoose = require('passport-local-mongoose');
const { authenticate } = require('passport');

///const bcrypt = require('bcrypt');
//const md5 = require('md5');
//const encrypt = require('mongoose-encryption');

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));
app.set('view engine', 'ejs');
app.use(session({
    secret: process.env.ES_SECRET,
    resave: false,
    saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());

const urlDB = 'mongodb://127.0.0.1:27017/userDB'
async function main() {
    await mongoose.connect(urlDB);
}

main().catch(error => { console.log(error) });

const userSchema = new mongoose.Schema({});

userSchema.plugin(passportLocalMongoose);

const User = mongoose.model('User', userSchema);

passport.use(User.createStrategy());
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.listen(process.env.PORT || 3301, () => { console.log('App On-Line') });

app.get('/', (req, res) => { res.redirect('/home') });

app.route('/home')
    .get((req, res) => {
        res.render('home');
    });

app.route('/login')
    .get((req, res) => {
        req.logOut((error) => {
            if (error) {
                console.log(error);
            }
        });
        res.render('login', { error: 'NA' });
    })
    .post((req, res) => {
        passport.authenticate('local', { failureRedirect: '/login', failureFlash: true, failureMessage: true })(req, res, function () {
            if ('passport' in req.session) {
                res.redirect('/secrets');
            } else {
                User.find({ username: req.body.username })
                    .then(doc => {
                        if (doc.length != 0) {
                            res.render('login', { error: 'password' });
                        } else {
                            res.render('login', { error: 'email' });
                        }
                    })
                    .catch(error => {
                        console.log(error);
                        res.redirect('/login');
                    })
            }
        })
    });

app.route('/register')
    .get((req, res) => {
        res.render('register', { error: false });
    })
    .post((req, res) => {
        const username = req.body.username;
        const userPassword = req.body.password;
        User.register({ username: username }, userPassword)
            .then(function (doc) {
                passport.authenticate('local')(req, res, function () {
                    res.render('secrets');
                });
            })
            .catch(function (error) {
                console.log('this fricking error...', error);
                res.render('register', { error: true });
            });
    });

app.route('/secrets')
    .get((req, res) => {
        if (req.isAuthenticated()) {
            res.render('secrets');
        } else {
            res.redirect('/login');
        }
    });

app.route('/logout')
    .get((req, res) => {
        req.logOut((error) => {
            if (error) {
                console.log(error);
            }
        });
        res.redirect('/');
    })