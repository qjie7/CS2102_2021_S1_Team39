const express = require("express");
const app = express();
const bcrypt = require("bcrypt");
const session = require("express-session");
const flash = require("express-flash");
const async = require("async");

const { pool } = require("./dbConfig");

const passport = require("passport");
const initializePassport = require("./passportConfig");
initializePassport(passport);

const PORT = process.env.PORT || 3000;

require("dotenv").config();

app.set("view engine", "ejs");
app.use(express.urlencoded({ extended: false }));

app.use(express.static(process.cwd() + '/public'));

app.use(
  session({
    secret: "secret",
    resave: false,
    saveUninitialized: false,
  })
);

app.use(passport.initialize());
app.use(passport.session());
app.use(flash());

/* ------------ GET ------------ */

// Home Page
app.get("/", (req, res) => {
  res.render("index");
});

app.get("/login", checkAuthenticated, (req, res) => {
  res.render("login");
});

// Register
app.get("/pet_owner_register", checkAuthenticated, (req, res) => {
  res.render("pet_owner_register");
});

app.get("/caretaker_register", checkAuthenticated, (req, res) => {
  res.render("caretaker_register");
});

app.get("/admin_register", checkAuthenticated, (req, res) => {
  res.render("admin_register");
});

// Dashboard
app.get("/dashboard", checkNotAuthenticated, (req, res) => {
  if (req.user.email.includes("+pet_owner")) {
    res.redirect("/pet_owner_home");
  } else if (req.user.email.includes("+caretaker")) {
    res.redirect("/caretaker_home");
  } else if (req.user.email.includes("+admin")) {
    res.redirect("/admin_home");
  } else {
    res.render("dashboard", { user: req.user.name });
  }
});

// Admin Home
app.get("/admin_home", checkNotAuthenticated, (req, res) => {
  let email = req.user.email;
  pool.query(`SELECT * FROM pet_category`, (err, data) => {
    let all_category_data = data;
		res.render('admin_home', { title: 'Admin Home', all_category: all_category_data.rows, user: req.user.name});
	});
});

// Pet Owner Home
app.get("/pet_owner_home", checkNotAuthenticated, (req, res) => {
  let email = req.user.email;
  pool.query(`SELECT * FROM pets_own_by WHERE pet_owner_email = $1`, [email], (err, data) => {
		res.render('pet_owner_home', { title: 'Pet Owner Home', data: data.rows, user: req.user.name});
	});
});

// Care Taker Home
app.get("/caretaker_home", checkNotAuthenticated, (req, res) => {
  let email = req.user.email;
  let type = req.user.type;
  // console.log(type);
  pool.query(`SELECT * FROM caretaker_has_availability WHERE caretaker_email = $1`, [email], (err, data) => {
    let availability_data = data;
    pool.query(`SELECT * FROM pet_category`, (err, data) => {
      let all_category_data = data;
      pool.query(`SELECT * FROM caretaker_has_charge WHERE caretaker_email = $1`, [email], (err, data) => {
        let charge_data = data;
        pool.query(`SELECT * FROM full_time_takes_leave WHERE caretaker_email = $1`, [email],(err, data) => {
          let leave_data = data;
          res.render('caretaker_home', { title: 'Care Taker', caretaker_type: type, charge: charge_data.rows, all_category: all_category_data.rows, availability: availability_data.rows, user: req.user.name, leave: leave_data.rows});
        })
        
      });
    });
  });
});

//Care Taker Search
app.get("/caretaker_search", checkNotAuthenticated, (req, res) => {
  let email = req.user.email;

    pool.query(`SELECT * FROM pets_own_by WHERE pet_owner_email = $1`,[email], (err, data) => {
      let all_pet_data = data; 
        res.render('caretaker_search', { title: 'Care Taker', errors: {}, all_pet: all_pet_data.rows, user: req.user.name});

    });
});

// Pet Owner Bids List
app.get("/bids_list", checkNotAuthenticated, (req, res) => {
  let email = req.user.email;

    pool.query(`SELECT * FROM pet_owner_bids_for B INNER JOIN caretaker C ON  B.caretaker_email = C.email WHERE pet_owner_email = $1`,[email], (err, data) => {
      let all_bid_data = data;
	  pool.query(`SELECT * FROM pets_taken_care_by T INNER JOIN caretaker C ON  T.caretaker_email = C.email WHERE pet_owner_email = $1`,[email], (err, data) => {
      let all_transaction_data = data;
        res.render('bids_list', { title: 'My Bids', data: all_bid_data.rows, transaction: all_transaction_data.rows, user: req.user.name});
	  });
    });
});

// Caretaker Bids Page
app.get("/caretaker_bids", checkNotAuthenticated, (req, res) => {
  let email = req.user.email;

    pool.query(`SELECT * FROM pet_owner_bids_for NATURAL JOIN pets_own_by NATURAL JOIN pet_owner WHERE caretaker_email = $1`,[email], (err, data) => {
      let all_bid_request_data = data;
        res.render('caretaker_bids', { title: 'My Bid Requests', data: all_bid_request_data.rows, user: req.user.name});

    });
});

// Log out
app.get("/logout", (req, res) => {
  req.logOut();
  req.flash("success_msg", "You have logged out");
  res.redirect("/");
});


/* ----------------------------------------------------- */

/* ------------ POST ------------ */

// After submitting registration form
app.post("/pet_owner_register", async (req, res) => {
  let { name, email, address, password, password2 } = req.body;

  console.log({
    name,
    email,
    address,
    password,
    password2,
  });

  let errors = [];

  if (!name || !email || !address || !password || !password2) {
    errors.push({ message: "Please enter all fields" });
  }

  if (password.length < 6) {
    errors.push({ message: "Password must be a least 6 characters long" });
  }

  if (password !== password2) {
    errors.push({ message: "Passwords do not match" });
  }

  if (errors.length > 0) {
    res.render("pet_owner_register", {
      errors,
      name,
      email,
      address,
      password,
      password2,
    });
    console.log(errors);
  } else {
    hashedPassword = await bcrypt.hash(password, 10);
    console.log(hashedPassword);

    pool.query(
      `SELECT * FROM pet_owner
        WHERE email = $1`,
      [email],
      (err, results) => {
        if (err) {
          throw err;
        }
        console.log(results.rows);

        if (results.rows.length > 0) {
          errors.push({ message: "Email already registered" });
          res.render("pet_owner_register", { errors });
        } else {
          email += '+pet_owner';
          pool.query(
            `INSERT INTO pet_owner (name, email, address, password)
                VALUES ($1, $2, $3, $4)
                `,
            [name, email, address, hashedPassword],
            (err, results) => {
              if (err) {
                throw err;
              }
              console.log("result", results.rows);
              req.flash(
                "success_msg",
                "You are now registered pet_owner. Please log in"
              );
              res.redirect("/login");
            }
          );
        }
      }
    );
  }
});

app.post("/caretaker_register", async (req, res) => {
  let { name, email, address, type, password, password2 } = req.body;

  console.log({
    name,
    email,
    address,
    type,
    password,
    password2,
  });

  let errors = [];

  if (!name || !email || !address || !type || !password || !password2) {
    errors.push({ message: "Please enter all fields" });
  }

  if (password.length < 6) {
    errors.push({ message: "Password must be a least 6 characters long" });
  }

  if (password !== password2) {
    errors.push({ message: "Passwords do not match" });
  }

  if (errors.length > 0) {
    res.render("caretaker_register", {
      errors,
      name,
      email,
      address,
      type,
      password,
      password2,
    });
  } else {
    hashedPassword = await bcrypt.hash(password, 10);
    console.log(hashedPassword);

    pool.query(
      `SELECT * FROM caretaker
        WHERE email = $1`,
      [email],
      (err, results) => {
        if (err) {
          throw err;
        }
        console.log(results.rows);

        if (results.rows.length > 0) {
          errors.push({ message: "Email already registered" });
          res.render("caretaker_register", { errors });
        } else {
          email += '+caretaker';
          pool.query(
            `INSERT INTO caretaker (name, email, address, type, password)
                VALUES ($1, $2, $3, $4, $5)
                `,
            [name, email, address, type, hashedPassword],
            (err, results) => {
              if (err) {
                throw err;
              }
              console.log(results.rows);
              req.flash(
                "success_msg",
                "You are now registered as caretaker. Please log in"
              );
              res.redirect("/login");
            }
          );
        }
      }
    );
  }
});

app.post("/admin_register", async (req, res) => {
  let { name, email, password, password2, password3 } = req.body;

  console.log({
    name,
    email,
    password,
    password2,
    password3,
  });

  let errors = [];

  if (!name || !email || !password || !password2 || !password3) {
    errors.push({ message: "Please enter all fields" });
  }

  if (password.length < 6) {
    errors.push({ message: "Password must be a least 6 characters long" });
  }

  if (password !== password2) {
    errors.push({ message: "Passwords do not match" });
  }

  if (password3 != process.env.SECRET_ADMIN_KEY) {
    errors.push({ message: "invalid Secret Admin Key" });
  }

  if (errors.length > 0) {
    res.render("admin_register", {
      errors,
      name,
      email,
      password,
      password2,
      password3,
    });
  } else {
    hashedPassword = await bcrypt.hash(password, 10);
    console.log(hashedPassword);

    pool.query(
      `SELECT * FROM admin
        WHERE email = $1`,
      [email],
      (err, results) => {
        if (err) {
          throw err;
        }
        console.log(results.rows);

        if (results.rows.length > 0) {
          errors.push({ message: "Email already registered" });
          res.render("admin_register", { errors });
        } else {
          email += "+admin";
          pool.query(
            `INSERT INTO admin (name, email, password)
                VALUES ($1, $2, $3)
                `,
            [name, email, hashedPassword],
            (err, results) => {
              if (err) {
                throw err;
              }
              console.log(results.rows);
              req.flash(
                "success_msg",
                "You are now registered as admin. Please log in"
              );
              res.redirect("/login");
            }
          );
        }
      }
    );
  }
});

// After submitting Log in Form (Check for authentication )
app.post(
  "/login",
  passport.authenticate("local", {
    successRedirect: "/dashboard",
    failureRedirect: "/login",
    failureFlash: true,
  })
);

app.post(
  "/pet_owner_home", async (req, res) => {
    let email = req.user.email;
    let { name, requirement, category } = req.body;
    console.log({
      email,
      name,
      requirement,
      category
    });

    let errors = [];

    if (!name || !category) {
      errors.push({ message: "Please enter all fields" });
    }
    if (errors.length > 0) {
      res.render("pet_owner_home", {
        errors,
        name,
        requirement,
        category
      });
    } else {
      pool.query(
        `INSERT INTO pets_own_by (pet_owner_email, pet_name, special_requirements, category_name)
          VALUES ($1, $2, $3, $4)
          `,
        [email, name, requirement, category],
        (err, results) => {
          if (err) {
            throw err;
          }
          console.log(results.rows);
          req.flash(
            "success_msg",
            "You successfully added a pet"
          );
          res.redirect("/pet_owner_home");
        }
      );
    }
  }
)

// admin adds pet category with basic charge
app.post(
  "/admin_home/category", async (req, res) => {
    let {category_name} = req.body;
    let {basic_charge} = req.body;
    console.log({
      category_name,
      basic_charge
    });

    let errors = [];

    if (!category_name) {
      errors.push({ message: "Please enter the category" });
    }
    if (!basic_charge) {
      errors.push({ message: "Please enter the daily charge" });
    }
    if (errors.length > 0) {
      res.render("admin_home", {
        category
      });
    } else {
      pool.query(
        `INSERT INTO pet_category (category_name, basic_charge)
          VALUES ($1, $2)
          `,
        [category_name, basic_charge],
        (err, results) => {
          if (err) {
            throw err;
          }
          console.log("pet_category", results.rows);
          req.flash(
            "success_msg",
            "You successfully added a pet category"
          );
        }
      );
      res.redirect("/admin_home");
    }
  }
)

// caretaker adds daily charge
app.post(
  "/caretaker_home/charge", async (req, res) => {
    let email = req.user.email;
    let {select_category} = req.body;
    let {charge} = req.body;
    console.log({
      select_category,
      charge
    });

    let errors = [];

    if (!select_category) {
      errors.push({ message: "Please enter the category" });
    }
    // if (!charge) {
    //   errors.push({ message: "Please enter the daily charge" });
    // }
    pool.query(`SELECT * FROM caretaker WHERE email = $1`, [email], (err, data) => {
      let type = data.rows[0].type;
      if (type == "part_time") {
        if (!charge) {
          errors.push({ message: "Please enter the daily charge" });
        }
      }
    });

    if (errors.length > 0) {
      res.render("caretaker_home", {
        // category
        select_category
      });
    } else {
      console.log({
        email
      });
      pool.query(
        // `INSERT INTO caretaker_has_charge (caretaker_email, category_name, amount)
        //   VALUES ($1, $2, $3)
        //   `,
        `CALL caretaker_charge($1, $2, $3)`,
        [email, select_category, charge],
        (err, results) => {
          if (err) {
            throw err;
          }
          console.log("charge", results.rows);
          req.flash(
            "success_msg",
            "You successfully added a charge for a pet category"
          );
        }
      );
      res.redirect("/caretaker_home");
    }
  }
)

// caretaker adds avaliability
app.post(
  "/caretaker_home/availability", async (req, res) => {
    let email = req.user.email;
    let {start_date, end_date} = req.body;
    
    console.log({

      start_date,
      end_date
    });

    let errors = [];


    if (!start_date || !end_date) {
      errors.push({ message: "Please enter all fields" });
    }
    if (errors.length > 0) {
      res.render("caretaker_home", {
        start_date,
        end_date
      });
    } else {
      pool.query(
        `INSERT INTO  caretaker_has_availability (caretaker_email, start_date, end_date)
          VALUES ($1, $2, $3)
          `,
        [email, start_date, end_date],
        (err, results) => {
          pool.query(
            `SELECT * FROM caretaker_has_availability WHERE caretaker_email = $1 AND start_date = $2 AND end_date = $3`,
            [email, start_date, end_date],
            (err, results) => {
              if (err) {
                throw err;
              }
              console.log("result", results.rows);
              if (results.rows.length > 0) {
                req.flash(
                  "available_success_msg",
                  "You successfully added your available days"
                );
              } else {
                req.flash(
                  "available_error",
                  "Invalid available days! Please check your selections"
                )
              }
              res.redirect("/caretaker_home");
            }
          )
        }
      );

    }
  }
)

//care taker take leaves
app.post(
  "/caretaker_home/takeleaves", async (req, res) => {
    let email = req.user.email;
    let {start_date, end_date} = req.body;
    console.log({
      start_date,
      end_date
    });

    let errors = [];


    if (!start_date || !end_date) {
      errors.push({ message: "Please enter all fields" });
    }
    if (errors.length > 0) {
      res.render("caretaker_home", {
        start_date,
        end_date
      });
    } else {
      pool.query(
        `CALL caretaker_take_leaves($1, $2, $3)`,
        [email, start_date, end_date],
        (err, results) => {
          pool.query(
            `SELECT * FROM full_time_takes_leave WHERE caretaker_email = $1 AND start_date = $2 AND end_date = $3`,
            [email, start_date, end_date],
            (err, results) => {
              if (err) {
                throw err;
              }
              console.log("result", results.rows);
              if (results.rows.length > 0) {
                req.flash(
                  "success_msg",
                  "You successfully added a leave"
                );
              } else {
                req.flash(
                  "error",
                  "Failed to take leave! You are currently taking care of at least one pet or You could have entered an invalid date"
                )
              }
              res.redirect("/caretaker_home");
            }
          ) 
          
        }

      );
    }
  }
)

// pet owner searches for caretaker for his pet
app.post(
  "/caretaker_search", async (req, res) => {
    let email = req.user.email;
    let {select_name} = req.body;
    let {select_category} = req.body;
    let {select_requirements} = req.body;
    let {start_date, end_date} = req.body;
    console.log(
      "print pet ", select_category
    );

    let errors = [];

    if (!select_category) {
      errors.push({ message: "Please enter the category" });
    }

    if (!start_date || !end_date) {
      errors.push({ message: "Please enter all fields" });
    }

    if (start_date >= end_date) {
      errors.push({ message: "Invalid Date! Please check you date input" });
    }

    if (errors.length > 0) {
      pool.query(`SELECT * FROM pets_own_by WHERE pet_owner_email = $1`,[email], (err, data) => {
        let all_pet_data = data;
          res.render('caretaker_search', { errors: errors, title: 'Care Taker', all_pet: all_pet_data.rows, user: req.user.name});
      });
    } else {
      pool.query(
                 `SELECT *
                  FROM ((caretaker c INNER JOIN caretaker_has_charge cc ON c.email = cc.caretaker_email)
                  INNER JOIN caretaker_has_availability ca ON c.email = ca.caretaker_email)
                  WHERE c.type = 'part_time' AND cc.category_name = $1 AND ca.start_date <= $2 AND ca.end_date >= $3`,
                  [select_category, start_date, end_date], (err, data) => {
                  let part_time_data = data;

                  pool.query(
                             `SELECT * FROM (caretaker c INNER JOIN caretaker_has_charge cc ON c.email = cc.caretaker_email)
                              WHERE c.type = 'full_time' AND cc.category_name = $1 AND c.email NOT IN
                             (SELECT DISTINCT c.email
                              FROM ((caretaker c INNER JOIN caretaker_has_charge cc ON c.email = cc.caretaker_email)
                              INNER JOIN full_time_takes_leave ft ON c.email = ft.caretaker_email)
                              WHERE c.type = 'full_time' AND cc.category_name = $1 AND ft.start_date <= $2 AND ft.end_date >= $3)`,
                              [select_category, start_date, end_date], (err, data) => {
                              let full_time_data = data;

        res.render('caretaker_list', { title: 'Caretaker List', part_time_data: part_time_data.rows, full_time_data: full_time_data.rows, user: req.user.name, userEmail: email, petName: select_name, petCategory: select_category, petRequirements: select_requirements,  startDate: start_date, endDate:end_date});
      });
      });
    }
  }
)

// pet owner bids for a part-time caretaker
app.post(
  "/caretaker_list/bid", async (req, res) => {	 
    let {petowner_email} = req.body;
    let {caretaker_email} = req.body;
    let {pet_name} = req.body;
    let {start_date} = req.body;
    let {end_date} = req.body;
    let {bid_amount} = req.body;

    let errors = [];

    console.log("print bid", petowner_email);

    if (errors.length > 0) {
      pool.query(`SELECT * FROM pets_own_by WHERE pet_owner_email = $1`,[petowner_email], (err, data) => {
        let all_pet_data = data;
          res.render('caretaker_search', { title: 'Care Taker', all_pet: all_pet_data.rows, user: req.user.name});
      });
    } else {
      pool.query(
        `INSERT INTO pet_owner_bids_for (pet_owner_email, caretaker_email, pet_name, startdate, enddate, amount)
          VALUES ($1, $2, $3, $4, $5, $6)
          `,
        [petowner_email, caretaker_email, pet_name, start_date, end_date, bid_amount],
        (err, results) => {
          // if (err) {
          //   throw err;
          // }
          pool.query(
            `SELECT * FROM pet_owner_bids_for WHERE pet_owner_email = $1 AND caretaker_email = $2 AND pet_name = $3 AND startdate = $4 AND enddate = $5`,
            [petowner_email, caretaker_email, pet_name, start_date, end_date],
            (err, results) => {
              if (err) {
                throw err;
              }
              console.log("result", results.rows);
              if (results.rows.length > 0) {
                req.flash(
                  "success_msg",
                  "You successfully bid for the caretaker"
                );
              } else {
                req.flash(
                  "error_msg",
                  "Invalid bid selection. It has already been taken care."
                )
              }
              res.redirect("/caretaker_search");
            }
          )
          // console.log(results.rows);
          // req.flash(
          //   "success_msg",
          //   "You successfully sent a bid"
          // );
          // res.redirect("/pet_owner_home");
        }
      );
    }    
  }
)

// pet owner books a full-time caretaker
app.post(
  "/caretaker_list/book", async (req, res) => {	 
    let {pet_owner_email} = req.body;
    let {care_taker_email} = req.body;
    let {petname} = req.body;
    let {startdate} = req.body;
    let {enddate} = req.body;
    let {amount} = req.body;
	let {payment_method} = req.body;
	let {method_to} = req.body;
	let {method_from} = req.body;

    let errors = [];

    console.log("print book", pet_owner_email);

    if (errors.length > 0) {
      pool.query(`SELECT * FROM pets_own_by WHERE pet_owner_email = $1`,[pet_owner_email], (err, data) => {
        let all_pet_data = data;
          res.render('caretaker_search', { title: 'Care Taker', all_pet: all_pet_data.rows, user: req.user.name});
      });
    } else {
		pool.query(
        `INSERT INTO pet_owner_bids_for (pet_owner_email, caretaker_email, pet_name, startdate, enddate, amount, status)
          VALUES ($1, $2, $3, $4, $5, $6, 2)
          `,
        [pet_owner_email, care_taker_email, petname, startdate, enddate, amount],
		(err, results) => {
			if (err) {
				throw err;					 
			}
			console.log("result", results.rows);
			if (results.rows.length > 0) {
				req.flash(
				"success_msg",						 
				"You successfully booked the caretaker"
				);
			} else {
				req.flash(
				"error_msg",
				"Invalid bid selection. It has already been taken care."
				)
			}
						 
			pool.query(
				`INSERT INTO pets_taken_care_by (pet_owner_email, pet_name, caretaker_email, start_date, end_date, payment_method, amount, method_to, method_from)
				  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
				  `,
				[pet_owner_email, petname, care_taker_email, startdate, enddate, payment_method, amount, method_to, method_from],
				(err, results) => {
					res.redirect("/caretaker_search"); 
				}
			  )
		});
    }    
  }
)

// caretaker accepts pet owner's bid
app.post(
  "/caretaker_bids/accept", async (req, res) => {
    let {petowner_email} = req.body;
	let {pet_name} = req.body;
    let {caretaker_email} = req.body;    
    let {start_date} = req.body;
    let {end_date} = req.body;
    let {amount} = req.body;

    let errors = [];

    console.log("pint bid accepted", caretaker_email);

    if (errors.length > 0) {
		pool.query(`SELECT * FROM pet_owner_bids_for NATURAL JOIN pets_own_by NATURAL JOIN pet_owner WHERE caretaker_email = $1`,[caretaker_email], (err, data) => {
			let all_bid_request_data = data;
			res.render('caretaker_bids', { title: 'My Bid Requests', data: all_bid_request_data.rows, user: req.user.name});
		});
    } else {
      pool.query(
        `UPDATE pet_owner_bids_for SET status = 1 WHERE pet_owner_email = $1 AND caretaker_email = $2 AND pet_name = $3 AND startdate = $4 AND enddate = $5`, [petowner_email, caretaker_email, pet_name, start_date, end_date],
        (err, results) => {
          if (err) {
            throw err;
          }
          console.log(results.rows);
          req.flash(
            "success_msg",
            "You successfully accepted a bid"
          );
          res.redirect("/caretaker_home");
        }
      );
    }

  }
)

// pet owner confirms transaction details
app.post(
  "/bids_list/confirm", async (req, res) => {
    let {petowner_email} = req.body;
	let {pet_name} = req.body;
    let {caretaker_email} = req.body;    
    let {start_date} = req.body;
    let {end_date} = req.body;
	let {payment_method} = req.body;
    let {amount} = req.body;
	let {method_to} = req.body;
	let {method_from} = req.body;

    let errors = [];

    console.log("pint transaction confirmed", caretaker_email);

    if (errors.length > 0) {
		pool.query(`SELECT * FROM pet_owner_bids_for NATURAL JOIN pets_own_by NATURAL JOIN caretaker WHERE pet_owner_email = $1`,[petowner_email], (err, data) => {			 
			 let all_bid_data = data;			 
			 pool.query(`SELECT * FROM pets_taken_care_by NATURAL JOIN caretaker WHERE pet_owner_email = $1`,[petowner_email], (err, data) => {
				 let all_transaction_data = data;		
				 res.render('bids_list', { title: 'My Bids', data: all_bid_data.rows, transaction: all_transaction_data.rows, user: req.user.name});
			});
		});
    } else {
      pool.query(
        `UPDATE pet_owner_bids_for SET status = 2 WHERE pet_owner_email = $1 AND caretaker_email = $3 AND pet_name = $2 AND startdate = $4 AND enddate = $5          
		`,
		[petowner_email, pet_name, caretaker_email, start_date, end_date],
		(err, results) =>{			
		  pool.query(
			`INSERT INTO pets_taken_care_by (pet_owner_email, pet_name, caretaker_email, start_date, end_date, payment_method, amount, method_to, method_from)
				VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)		
			`,       
			[petowner_email, pet_name, caretaker_email, start_date, end_date, payment_method, amount, method_to, method_from],
			(err, results) => {
			  if (err) {
				throw err;
			  }
			  console.log(results.rows);
			  req.flash(
				"success_msg",
				"You successfully confirmed transaction details"
			  );
			  res.redirect("/pet_owner_home");
			}
		  )		  
		}
	  );	  	      
    }

  }
)

// pet owner adds rating details
app.post(
  "/bids_list/rating", async (req, res) => {
	let petowner_email = req.user.email;
	let {petname} = req.body;
    let {care_taker_email} = req.body; 
	let {startdate} = req.body;	
    let {rating_stars} = req.body;
	let {rating_comment} = req.body;

    let errors = [];

    console.log("pint rating confirmed", petowner_email, petname, care_taker_email, startdate, rating_stars, rating_comment);

    if (errors.length > 0) {
		pool.query(`SELECT * FROM pet_owner_bids_for NATURAL JOIN pets_own_by NATURAL JOIN caretaker WHERE pet_owner_email = $1`,[petowner_email], (err, data) => {			 
			 let all_bid_data = data;			 
			 pool.query(`SELECT * FROM pets_taken_care_by NATURAL JOIN caretaker WHERE pet_owner_email = $1`,[petowner_email], (err, data) => {
				 let all_transaction_data = data;		
				 res.render('bids_list', { title: 'My Bids', data: all_bid_data.rows, transaction: all_transaction_data.rows, user: req.user.name});
			});
		});
    } else {
      pool.query(
        `UPDATE pets_taken_care_by SET rating_stars = $5, rating_comment = $6 WHERE pet_owner_email = $1 AND pet_name = $2 AND caretaker_email = $3 AND start_date = $4
          `,
        [petowner_email, petname, care_taker_email, startdate, rating_stars, rating_comment],
        (err, results) => {
          if (err) {
            throw err;
          }
          console.log(results.rows);
          req.flash(
            "success_msg",
            "You successfully confirmed rating details"
          );
          res.redirect("/pet_owner_home");
        }
      );
    }

  }
)

// admin salary to caretaker
app.post(
  "/admin_home/salary", async (req, res) => {
    let {year} = req.body;
    let {month} = req.body;
    let email = req.user.email;
    console.log({
      year,
      month,
      email
    });

    let errors = [];

    if (!year) {
      errors.push({ message: "Please enter the year" });
    }
    if (!month) {
      errors.push({ message: "Please enter the month" });
    }

    if (errors.length > 0) {
      res.render("admin_home", {
        year,
        month,
        email
      });
    } else { 
      pool.query(
        `SELECT email, type FROM caretaker`,
        (err, results)=> {
          if (err) throw err;
          let caretakers = results.rows;
          console.log(caretakers);

          async.eachSeries(
            caretakers, function(caretaker, callback){
              pool.query(
                `SELECT amount, start_date, end_date FROM pets_taken_care_by ptcb
                 WHERE ptcb.caretaker_email = $1 AND date_part('month', start_date) = $2 
                 AND date_part('year', start_date) = $3`,
                 [caretaker.email, month, year],
                 (err, results)=> {
                  if (err) {
                    callback(new Error('Failed to process' + caretaker));
                  } else {
                    console.log(caretaker + 'processed');
                    callback(null);
                  }
                      var sum = 0;
                      var pet_day = 0;
                      var transactions = results.rows;
                      console.log(transactions);
                      console.log(caretaker.type);
                  if (caretaker.type == 'full_time') {

                    for (var i = 0; i < transactions.length; i++) {
                      let s_date = Date.parse(transactions[i].start_date) / (60*60*24*1000);
                      let e_date = Date.parse(transactions[i].end_date) / (60*60*24*1000);
                      //sum += (e_date - s_date + 1) * transactions[i].amount;
                      if (pet_day < 60) {
                        pet_day += e_date - s_date + 1;
                      } else {
                        sum += (e_date - s_date + 1) * (transactions[i].amount * 0.8);
                      }
                      
                    }
                    sum += 3000;
                      
                  } else {
                    for (var i = 0; i < transactions.length; i++) {
                      let s_date = Date.parse(transactions[i].start_date) / (60*60*24*1000);
                      let e_date = Date.parse(transactions[i].end_date) / (60*60*24*1000);
                      sum += (e_date - s_date + 1) * (transactions[i].amount * 0.75);
                    }
                  }
                  
                  pool.query(
                    `INSERT INTO caretaker_salaried_by VALUES ($1, $2, $3, $4, $5)`,
                    [caretaker.email,email, sum, year, month],
                    (err, results)=> {
                      if (err) {
                        throw err;
                      }
                    }
                  );



                 }
              );
            }
          )
        }
      );
    }
    req.flash(
      "success_msg",
      "Successfully inserted caretaker salary "
    );
    res.redirect("/admin_home");
  }
)

/* ----------------------------------------------------- */

/* ------------------- Functions --------------------- */
function checkAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return res.redirect("/dashboard");
  }
  next();
}

function checkNotAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect("/index");
}

// Date.prototype.addDays = function(days) {
//   var date = new Date(this.valueOf());
//   date.setDate(date.getDate() + days);
//   return date;
// }

// Date.prototype.yyyymmdd = function() {
//   var mm = this.getMonth() + 1; // getMonth() is zero-based
//   var dd = this.getDate();

//   return [this.getFullYear(),
//           (mm>9 ? '' : '0') + mm,
//           (dd>9 ? '' : '0') + dd
//          ].join('');
// };

/* ----------------------------------------------------- */

// catch 404 and forward to error handler
// app.use(function (req, res, next) {
//   next(createError(404));
// });

// error handler
// app.use(function (err, req, res, next) {
//   // set locals, only providing error in development
//   res.locals.message = err.message;
//   res.locals.error = req.app.get("env") === "development" ? err : {};

//   // render the error page
//   res.status(err.status || 500);
//   res.render("error");
// });

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
