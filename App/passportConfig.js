const LocalStrategy = require("passport-local").Strategy;
const { pool } = require("./dbConfig");
const bcrypt = require("bcrypt");

function initialize(passport) {
  const authenticateUser = (req, email, password, done) => {
    let {login_type} = req.body;
    console.log(email, password, login_type);
    if (login_type == 'pet_owner') {
      email += '+pet_owner';
      console.log(email, password, login_type);
      pool.query(
        `SELECT * FROM pet_owner WHERE email = $1`,
        [email],
        (err, results) => {
          if (err) {
            throw err;
          }
          console.log(results.rows);
  
          if (results.rows.length > 0) {
            const user = results.rows[0];
  
            bcrypt.compare(password, user.password, (err, isMatch) => {
              if (err) {
                throw err;
              }
              if (isMatch) {
                return done(null, user);
              } else {
                //password is incorrect
                return done(null, false, { message: "Password is incorrect" });
              }
            });
          } else {
            // No user
            return done(null, false, {
              message: "No user with that email address",
            });
          }
        }
      );
    }
    
    if (login_type == 'caretaker') {
      email += '+caretaker';
      pool.query(
        `SELECT * FROM caretaker WHERE email = $1`,
        [email],
        (err, results) => {
          if (err) {
            throw err;
          }
          console.log(results.rows);
  
          if (results.rows.length > 0) {
            const user = results.rows[0];
  
            bcrypt.compare(password, user.password, (err, isMatch) => {
              if (err) {
                throw err;
              }
              if (isMatch) {
                return done(null, user);
              } else {
                //password is incorrect
                return done(null, false, { message: "Password is incorrect" });
              }
            });
          } else {
            // No user
            return done(null, false, {
              message: "No user with that email address",
            });
          }
        }
      );
    }

    if (login_type == 'admin')  {
      email += '+admin';
      pool.query(
        `SELECT * FROM admin WHERE email = $1`,
        [email],
        (err, results) => {
          if (err) {
            throw err;
          }
          console.log(results.rows);
  
          if (results.rows.length > 0) {
            const user = results.rows[0];
  
            bcrypt.compare(password, user.password, (err, isMatch) => {
              if (err) {
                throw err;
              }
              if (isMatch) {
                return done(null, user);
              } else {
                //password is incorrect
                return done(null, false, { message: "Password is incorrect" });
              }
            });
          } else {
            // No user
            return done(null, false, {
              message: "No user with that email address",
            });
          }
        }
      );
    }
  };

passport.use('local', new LocalStrategy(
    { usernameField: "email", passwordField: "password", passReqToCallback: true },
    authenticateUser
)
);

  // Stores user details inside session. serializeUser determines which data of the user
  // object should be stored in the session. The result of the serializeUser method is attached
  // to the session as req.session.passport.user = {}. Here for instance, it would be (as we provide
  //   the user id as the key) req.session.passport.user = {id: 'xyz'}
  //passport.serializeUser((user, done) => done(null, user.email));
  passport.serializeUser((user, done) =>
    
  
  done(null, user.email));
  // In deserializeUser that key is matched with the in memory array / database or any data resource.
  // The fetched object is attached to the request object as req.user

  passport.deserializeUser((email, done) => {
    console.log("deserialize");
      console.log("Email is " + email);

      if (email.includes("+pet_owner")) {
        pool.query(
          `SELECT * FROM pet_owner WHERE email = $1`,
          [email],
          (err, results) => {
            if (err) {
              return done(err);
            }
            // console.log(`email is ${results.rows[0].email}`);
            return done(null, results.rows[0]);
          }
        );
      }

      if (email.includes("+caretaker")) {
        pool.query(
          `SELECT * FROM caretaker WHERE email = $1`,
          [email],
          (err, results) => {
            if (err) {
              return done(err);
            }
            //   console.log(`email is ${results.rows[0].email}`);
            return done(null, results.rows[0]);
          }
        );
      }

      if (email.includes("+admin")) {
        pool.query(
          `SELECT * FROM admin WHERE email = $1`,
          [email],
          (err, results) => {
            if (err) {
              return done(err);
            }
            //   console.log(`email is ${results.rows[0].email}`);
            return done(null, results.rows[0]);
          }
        );
      }
      

  });
}



module.exports = initialize;
