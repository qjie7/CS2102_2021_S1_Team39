CREATE TABLE IF NOT EXISTS pet_owner (
    email       VARCHAR PRIMARY KEY,
    name        VARCHAR(64) NOT NULL,
    address     VARCHAR NOT NULL,
    password    VARCHAR NOT NULL
);

CREATE TABLE IF NOT EXISTS caretaker (
    email           VARCHAR PRIMARY KEY,
    name            VARCHAR(64) NOT NULL,
    address         VARCHAR NOT NULL,
    password        VARCHAR(64) NOT NULL,
    type            VARCHAR NOT NULL,
    overall_rating  NUMERIC(3,2)
);

CREATE TABLE IF NOT EXISTS admin (
    email       VARCHAR PRIMARY KEY,
    name        VARCHAR(64) NOT NULL,
    password    VARCHAR NOT NULL
);

CREATE TABLE IF NOT EXISTS pet_category (
    category_name VARCHAR PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS pets_own_by (
    pet_owner_email VARCHAR REFERENCES pet_owner(email)
                        ON DELETE CASCADE,
    pet_name VARCHAR NOT NULL,
    special_requirements VARCHAR,
    category_name VARCHAR REFERENCES pet_category(category_name),
    PRIMARY KEY (pet_owner_email, pet_name),
	UNIQUE (pet_name)
);

CREATE TABLE IF NOT EXISTS caretaker_has_availability (
	caretaker_email VARCHAR REFERENCES caretaker(email),
	start_date DATE,
	end_date DATE,
	PRIMARY KEY (caretaker_email, start_date, end_date)
);

CREATE TABLE IF NOT EXISTS caretaker_has_charge (
	caretaker_email  VARCHAR REFERENCES caretaker(email),
	category_name VARCHAR REFERENCES pet_category(category_name),
    amount NUMERIC,
	PRIMARY KEY (caretaker_email, category_name)
);

CREATE TABLE IF NOT EXISTS pet_owner_bids_for (
    pet_owner_email VARCHAR REFERENCES pet_owner(email),
    caretaker_email VARCHAR REFERENCES caretaker(email),
    pet_name        VARCHAR REFERENCES pets_own_by(pet_name) UNIQUE,
    startdate       DATE NOT NULL UNIQUE,
    enddate         DATE NOT NULL UNIQUE,
    amount          NUMERIC NOT NULL,
	status			BIT DEFAULT 0::BIT NOT NULL,
    PRIMARY KEY (pet_owner_email, caretaker_email, pet_name, startdate, enddate)
);

CREATE TABLE IF NOT EXISTS pets_taken_care_by (
	pet_owner_email VARCHAR REFERENCES pet_owner(email)
         	          ON DELETE CASCADE,
	pet_name VARCHAR REFERENCES pets_own_by(pet_name),
	caretaker_email VARCHAR REFERENCES caretaker(email),
	start_date DATE NOT NULL REFERENCES pet_owner_bids_for(startdate),
	end_date DATE NOT NULL REFERENCES pet_owner_bids_for(enddate),
	payment_method VARCHAR(64) NOT NULL,
	amount NUMERIC NOT NULL,
	method_to VARCHAR(64) NOT NULL,
	method_from VARCHAR(64) NOT NULL,
	rating_stars NUMERIC,
	rating_comment VARCHAR,
	PRIMARY KEY (pet_owner_email, pet_name, caretaker_email, start_date)
);

CREATE TABLE full_time_takes_leave(
	caretaker_email  VARCHAR REFERENCES caretaker(email) 
  	                       ON DELETE CASCADE,
	start_date DATE NOT NULL,
	end_date DATE NOT NULL,
	PRIMARY KEY(caretaker_email, start_date)
);


CREATE OR REPLACE PROCEDURE
caretaker_take_leaves(email VARCHAR, s_date DATE, e_date DATE) AS
$$ DECLARE pet_count NUMERIC;
    BEGIN 
        SELECT COUNT(*) INTO pet_count FROM pets_taken_care_by PT
        WHERE email = PT.caretaker_email AND PT.end_date > s_date;
        IF pet_count = 0 THEN
            INSERT INTO full_time_takes_leave(caretaker_email, start_date, end_date)
            VALUES (email, s_date, e_date);
            END IF;
            END; $$
LANGUAGE plpgsql;