require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const findOrCreate = require('mongoose-findorcreate');
const session = require('express-session');
const MemoryStore = require('memorystore')(session);
const passport = require('passport');
const localStrategy = require('passport-local');
const passportLocalMongoose = require('passport-local-mongoose');
const { authenticate } = require('passport');
const { urlencoded } = require('express');
const googleStrategy = require('passport-google-oauth20').Strategy;
const facebookStrategy = require('passport-facebook').Strategy;

///const bcrypt = require('bcrypt');
//const md5 = require('md5');
//const encrypt = require('mongoose-encryption');

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));
app.set('view engine', 'ejs');
app.use(session({
    cookie: { maxAge: 86400000 },
    store: new MemoryStore({
        checkPeriod: 86400000
    }),
    secret: process.env.ES_SECRET,
    resave: false,
    saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());

const localDB = 'mongodb://127.0.0.1:27017/userDB';
const atlasDB = `${process.env.ATLASDB}/secretsDB`;
async function main() {
    await mongoose.connect(atlasDB);
}

main().catch(error => { console.log(error) });

const userSchema = new mongoose.Schema({
    username: String,
    email: String,
    googleId: String,
    facebookId: String,
    password: String
});

const secretSchema = new mongoose.Schema({
    secret: String,
    date: String,
    username: String
})

userSchema.plugin(passportLocalMongoose, { usernameField: 'email' });
userSchema.plugin(findOrCreate);

const User = mongoose.model('User', userSchema);
const Secret = mongoose.model('Secret', secretSchema);

passport.use(new localStrategy({ usernameField: 'email' }, User.authenticate()));

passport.use(new googleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "https://secrets-v7cy.onrender.com/auth/google/secrets",
    userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo"
},
    function (accessToken, refreshToken, profile, cb) {
        User.findOrCreate({ googleId: profile.id, username: profile.displayName }, function (err, user) {
            console.log(profile);
            return cb(err, user);
        });
    }
));

passport.use(new facebookStrategy({
    clientID: process.env.FB_CLIENT_ID,
    clientSecret: process.env.FB_CLIENT_SECRET,
    callbackURL: "https://secrets-v7cy.onrender.com/auth/facebook/secrets",
},
    function (accessToken, refreshToken, profile, cb) {
        User.findOrCreate({ facebookId: profile.id, username: profile.displayName }, function (err, user) {
            console.log(profile);
            return cb(err, user);
        });
    }
));

passport.serializeUser(function (user, cb) {
    process.nextTick(function () {
        return cb(null, {
            id: user._id,
            username: user.username,
            email: user.email
        });
    });
});
passport.deserializeUser(function (user, cb) {
    User.findById(user.id)
        .then((doc) => {
            return cb(null, doc);
        })
        .catch((error) => {
            return cb(error, user);
        });
});

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
                res.redirect('/login');
            }
        });
        res.render('login', { error: 'NA' });
    })
    .post((req, res) => {
        User.findOne({ email: req.body.email })
            .then(user => {
                if (user == null) {
                    res.render('login', { error: 'email' });
                } else {
                    passport.authenticate('local', { failureRedirect: '/login', failureMessage: true })(req, res, function () {
                        if (req.isAuthenticated()) {
                            res.redirect('/secrets');
                        } else {
                            res.render('login', { error: 'password' });
                        }
                    });
                }
            }).catch(error => { console.log(error); res.redirect('/login') });
    });

app.route('/register')
    .get((req, res) => {
        res.render('register', { error: false });
    })
    .post((req, res) => {
        const username = req.body.username;
        const userEmail = req.body.email;
        const userPassword = req.body.password;
        User.findOne().or([{ email: userEmail }, { username: username }])
            .then(doc => {
                if (doc != null) {
                    if (doc.email == userEmail) {
                        res.render('register', { error: 'email' });
                    } else if (doc.username == username) {
                        res.render('register', { error: 'username' });
                    }
                } else {
                    User.register({ username: username, email: userEmail }, userPassword)
                        .then(doc => {
                            passport.authenticate('local')(req, res, function () {
                                res.redirect('/secrets')
                            });
                        })
                        .catch(error => {
                            console.log('This error in Register User... ', error);
                            res.redirect('/register');
                        })
                }
            }).catch(error => { console.log(error); res.redirect('/register'); });
    });

app.route('/secrets')
    .get((req, res) => {
        if (req.isAuthenticated()) {
            Secret.find()
                .then(docs => {
                    res.render('secrets', { allSecrets: docs ? docs : [] });
                })
                .catch(error => {
                    console.log('this error in secrets render... ', error);
                    res.redirect('/secrets')
                })
        } else {
            res.redirect('/login');
        }
    });

app.route('/submit')
    .get((req, res) => {
        if (req.isAuthenticated()) {
            const date = new Date();
            const thisDate = {
                day: date.getDay(),
                month: date.getMonth(),
                year: date.getFullYear(),
                hour: date.getHours(),
                minutes: date.getMinutes(),
                toString: function () {
                    return `${this.day}-${this.month}-${this.year}  ${this.hour}:${this.minutes}`
                }
            };
            const username = req.user.username;
            res.render('submit', { thisDate: thisDate.toString(), username: username });
        } else {
            res.redirect('/login');
        }
    })
    .post((req, res) => {
        const newSecret = new Secret({
            secret: req.body.secret,
            date: req.body.date,
            username: req.body.anonymous ? req.body.username : 'Anonymous'
        });
        newSecret.save()
        res.redirect('/secrets');
    });

app.route('/logout')
    .get((req, res) => {
        req.logOut((error) => {
            if (error) {
                console.log(error);
            }
        });
        res.redirect('/');
    });

app.get('/auth/google', passport.authenticate('google', { scope: ['profile'] }));

app.get('/auth/google/secrets',
    passport.authenticate('google', { failureRedirect: '/login' }),
    function (req, res) {
        res.redirect('/secrets');
    });

app.get('/auth/facebook', passport.authenticate('facebook', { scope: ['public_profile'] }));

app.get('/auth/facebook/secrets',
    passport.authenticate('facebook', { failureRedirect: '/login' }),
    function (req, res) {
        res.redirect('/secrets');
    });

app.get('/terms', (req, res) => { res.render('terms') });
app.get('/privacy', (req, res) => { res.render('privacy') });