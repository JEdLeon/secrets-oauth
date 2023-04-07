require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const encrypt = require('mongoose-encryption');

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));
app.set('view engine', 'ejs');

const urlDB = 'mongodb://127.0.0.1:27017/userDB'
async function main() {
    await mongoose.connect(urlDB);
}

main().catch(error => { console.log(error) });

const userSchema = new mongoose.Schema({
    email: String,
    password: String
});

userSchema.plugin(encrypt, { secret: process.env.DB_SECRET, encryptedFields: ['password'] });

const User = mongoose.model('User', userSchema);

app.listen(process.env.PORT || 3301, () => { console.log('App On-Line') });

app.get('/', (req, res) => { res.redirect('/home') });

app.route('/home')
    .get((req, res) => {
        res.render('home');
    });

app.route('/login')
    .get((req, res) => {
        res.render('login', { error: 'NA' });
    })
    .post((req, res) => {
        const userEmail = req.body.username;
        const userPassword = req.body.password;
        User.find({ email: userEmail })
            .then(doc => {
                if (doc.length != 0) {
                    if (doc[0].password == userPassword) {
                        res.render('secrets');
                    } else {
                        res.render('login', { error: 'password' });
                    }
                } else {
                    res.render('login', { error: 'email' });
                }
            })
            .catch(error => {
                console.error(error);
            });
    });

app.route('/register')
    .get((req, res) => {
        res.render('register', { error: false });
    })
    .post((req, res) => {
        const userEmail = req.body.username;
        const userPassword = req.body.password;
        User.find({ email: userEmail })
            .then(doc => {
                if (doc.length == 0) {
                    const newUser = new User({
                        email: userEmail,
                        password: userPassword
                    });
                    newUser.save()
                        .catch(error => {
                            console.log(error);
                        })
                        .finally(() => {
                            res.render('secrets');
                        });
                } else {
                    res.render('register', { error: true });
                }
            })
            .catch(error => {
                console.error(error);
            });
    });