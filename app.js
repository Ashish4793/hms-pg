//jshint esversion:6
require('dotenv').config();
const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose")
const ejs = require("ejs");
const session = require("express-session");
const MongoStore = require('connect-mongo')(session);
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const stripe = require('stripe')(process.env.STRIPE_KEY);
const YOUR_DOMAIN = "http://hms.cyclic.app";

const app = express();

app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({extended: true}));
app.use(express.static("public"));

app.use(session({
    secret : process.env.PASSPORT_KEY,
    resave : false,
    saveUninitialized : false,
    cookie : {
        expires : 200000
    },
    store: new MongoStore({ mongooseConnection: mongoose.connection })
}));

app.use(passport.initialize());
app.use(passport.session());


mongoose.set("strictQuery" ,false);
const connectDB = async () => {
    try {
      const conn = await mongoose.connect(process.env.MONGO_URI);
      console.log(`MongoDB Connected: ${conn.connection.host}`);
  
    } catch (error) {
      console.log(error);
      process.exit(1);
    }
};
const userSchema = new mongoose.Schema({
    email : {type : String , unique : true},
    name : String,
    phone : {type : String , unique : true},
    username : {type : String , unique : true},
    secAnswer : String,
    password : String
});

userSchema.plugin(passportLocalMongoose);

const consumerBookingSchema = new mongoose.Schema({
    bookingID : {type : String , unique :true},
    bookingDate : String,
    bookingName : String,
    bookingUphn : String,
    bookingUemail : String,
    bookindUsername : String,
    checkinDate : String,
    checkoutDate : String,
    RoomPTRF : String,
    DaysStay : String,
    RoomType : String,
    Status : String,
    Price : String,
});


const User = mongoose.model("User" , userSchema);

passport.use(User.createStrategy());

passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

const consumerBooking = mongoose.model("consumerBooking" , consumerBookingSchema);


app.get("/" , function(req,res){
    res.render("home");
});

app.get("/login" , function(req,res){
    res.render("login");
});

app.get("/register" , function(req,res){
    res.render("register");
});

app.get("/wrongpass" , function(req,res){
    res.render("errors/wrongpass");
});

app.post("/login", passport.authenticate("local",{
    successRedirect: "/",
    failureRedirect: "/wrongpass"
  }), function(req, res){
});

app.post("/register" , function(req,res){
    User.register({username : req.body.username, email : req.body.email, name : req.body.name ,phone : req.body.phone , secAnswer : req.body.secAnswer} , req.body.password , function(err,user){
        if (err){
            res.render("errors/uaxerror")
        } else {
            passport.authenticate("local")(req,res,function(){
                res.redirect("/");
            });
        }
    });    
});

app.get("/about" , function(req,res){
    res.render("about");
});

app.get("/rooms" , function(req,res){
    res.render("rooms");
});



app.get("/contact" , function(req,res){
    res.render("contact");
});

app.get("/forgotpass" , function(req,res){
    res.render("forgotpass");
});

let hue;
app.post("/forgotpass",function(req,res){
    hue = req.body.username
    User.findOne({username: hue}, function(err,foundUser){
        if(foundUser===null){
            res.render("errors/swrerror")
        } else {
            res.render("resetpass" , {userData : foundUser});
        }
    });
});

app.post("/resetpass" , function(req,res){
    User.findOne({username : hue} , function(err, foundUser){
        if (foundUser.secAnswer===req.body.enteredsecAnswer){
            if (!err){
                foundUser.setPassword(req.body.password , function(){
                    foundUser.save();
                    res.render("errors/success")
                });
            } else {
                res.render("errors/swrerror")
            }
        } else {
            res.render("errors/swrerror")
        }
    });
});


app.get("/changepass" , function(req,res){
    if(req.isAuthenticated()){
        res.render("changepass");
    } else{
        res.redirect("/login");
    }
});

app.get("/successpg" , function(req,res){
    if(req.isAuthenticated()){
        res.render("partials/successpg");
    } else{
        res.redirect("/login");
    }
});

app.get("/failpg" , function(req,res){
    if(req.isAuthenticated()){
        res.render("partials/failpg");
    } else{
        res.redirect("/login");
    }
});



app.post("/changepass", function(req,res){
    if (req.isAuthenticated()){
        const userID = req.user.username;
        User.findOne({username : userID} , function(err,foundUser){
            if (foundUser!=null){
                foundUser.changePassword(req.body.oldpass , req.body.newpass , function(err){
                    if(err){
                        if (err.name ==="IncorrectPasswordError"){
                            res.render("errors/wrongpass");
                        } else {
                            res.render("errors/swrerror")
                        }
                    } else {
                        res.render("errors/success");
                    }
                });
            } else {
                res.render("errors/swrerror")
            }
        });
    } else {
        res.redirect("/");
    }
});



app.get("/profile" , function(req,res){
    if (req.isAuthenticated()){
        User.findOne({username : req.user.username} , function(err , foundUser){
            res.render("profile" , {userFound : foundUser})
        });
    } else {
        res.redirect("/login");
    }
});

app.get("/logout" , function(req,res){
    req.logout(function(err){});
    res.redirect("/");
});

app.get("/cancelbooking" , function(req,res){
    if (req.isAuthenticated()){
        consumerBooking.find({bookindUsername : req.user.username} , function(err, foundBookings){
            res.render("canceloption", {bookingsFound : foundBookings });
        });
    } else {
        res.redirect("/login");
    }
});

app.get("/bookings" , function(req,res){
    if (req.isAuthenticated()){
        consumerBooking.find({bookindUsername : req.user.username} , function(err, foundBookings){
            res.render("bookings", {bookingsFound : foundBookings });
        });
    } else {
        res.redirect("/login");
    }
});


app.post("/cancelbooking" , function(req,res){
    if (req.isAuthenticated()){
        consumerBooking.findOneAndDelete({bookingID : req.body.bookingid} , function(err){
            if (!err){
                res.render("partials/cancelsuccess")
            } else {
                console.log(err);
            }
        });
    } else {
        res.redirect("/login");
    }
});

let InDate;
let OutDate;
let roomType;
let days;
let tariff;
let rndomNo;
let perDayTariff;


app.post("/checkroom" , function(req,res){
    if (req.isAuthenticated()){
        rndomNo = Math.floor(1000 + Math.random() * 9000).toString();
        InDate = req.body.checkInDate;
        OutDate = req.body.checkOutDate;
        roomType = req.body.roomtype;
        const startDate = Date.parse(InDate);
        const endDate = Date.parse(OutDate);
        const diff = new Date(endDate - startDate);
        days = diff/1000/60/60/24;
        if (roomType==="Single Bedded"){
            perDayTariff = 1250;
        } else if (roomType==="Double Bedded"){
            perDayTariff = 3000;
        } else {
            perDayTariff = 6000;
        }
        if(days!=0){
            if (roomType === "Single Bedded"){
                tariff = 1250 * days;
            } else if (roomType === "Double Bedded"){
                tariff = 3000 * days;
            } else {
                tariff = 6000 * days;
            }
        } else{
            if (roomType === "Single Bedded"){
                tariff = 1250;
            } else if (roomType === "Double Bedded"){
                tariff = 3000;
            } else {
                tariff = 6000;
            }
        }
        if (days===0){
            days = 1;
        }
        res.render("room-avail",{inDate : InDate , outDate : OutDate , roomtype : roomType , stayDays : days , totalAmount : tariff , perDayT : perDayTariff});    
    } else {
        res.redirect("/login");
    }
});

app.post("/create-checkout-session", async (req, res) => {
    if (req.isAuthenticated()){
        const username = req.user.username;
        const todayDate = new Date().toISOString().slice(0, 10);
        const bookings = new consumerBooking({
                bookingID : rndomNo,
                bookingDate : todayDate,
                bookingName : req.user.name,
                bookingUphn : req.user.phone,
                bookingUemail : req.user.email,
                bookindUsername : username,
                checkinDate : InDate,
                checkoutDate : OutDate,
                RoomPTRF : perDayTariff,
                DaysStay : days,
                RoomType : roomType,
                Status : "Not yet confirmed",
                Price : tariff
        });
        bookings.save();
        if (roomType === "Double Bedded"){
          const session = await stripe.checkout.sessions.create({
            line_items: [
              {
                // Provide the exact Price ID (for example, pr_1234) of the product you want to sell
                price: "price_1MdtFuSAhl3Y4vKuXWumImeH",
                quantity: days,
              },
            ],
            mode: 'payment',
            success_url: `${YOUR_DOMAIN}/successpg`,
            cancel_url: `${YOUR_DOMAIN}/failpg`,
          });
        
          res.redirect(303, session.url);
        } else if (roomType === "Single Bedded") {
          const session = await stripe.checkout.sessions.create({
            line_items: [
              {
                // Provide the exact Price ID (for example, pr_1234) of the product you want to sell
                price: "price_1Mduu1SAhl3Y4vKu7uSO3IQ9",
                quantity: days,
              },
            ],
            mode: 'payment',
            success_url: `${YOUR_DOMAIN}/successpg`,
            cancel_url: `${YOUR_DOMAIN}/failpg`,
          });
        
          res.redirect(303, session.url); 
        } else {
            const session = await stripe.checkout.sessions.create({
                line_items: [
                  {
                    // Provide the exact Price ID (for example, pr_1234) of the product you want to sell
                    price: "price_1MduvDSAhl3Y4vKurDcmmDuN",
                    quantity: days,
                  },
                ],
                mode: 'payment',
                success_url: `${YOUR_DOMAIN}/successpg`,
                cancel_url: `${YOUR_DOMAIN}/failpg`,
            });
            
            res.redirect(303, session.url);
        }
    } else {
        res.redirect("/login");
    }
});

// app.post("/bookroom" , function(req,res){
//     if (req.isAuthenticated()){
//         const username = req.user.username;
//         const bookings = new consumerBooking({
//             bookingID : rndomNo,
//             bookindUsername : username,
//             checkinDate : InDate,
//             checkoutDate : OutDate,
//             RoomType : roomType,
//             Status : "Not yet confirmed",
//             Price : tariff
//         });
//         bookings.save(function(err){
//             if (!err){
//                 res.render("partials/booksuccess", {id : rndomNo})
//             } else {
//                 res.render("errors/swrerror")
//             }
//         });
//     } else {
//         res.redirect("/login")
//     }
// });

app.post("/viewinvoice" , function(req,res){
    if (req.isAuthenticated()){
        consumerBooking.findOne({bookingID : req.body.bID} , function(err , foundBooking){
            if (!err){
                res.render("viewinvoice" , {booking : foundBooking});
            } else {
                console.log(err);
            }
        })
    } else {
        res.redirect("/login");
    }
});


connectDB().then(() => {
    console.log("hmsDB CONNECTED SUCCESFULLY");
    app.listen(3000, () => {
        console.log("HMS-PG Server STARTED");
    })
});