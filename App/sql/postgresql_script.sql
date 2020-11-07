DROP TABLE admin CASCADE;
DROP TABLE caretaker CASCADE;
DROP TABLE caretaker_has_availability CASCADE;
DROP TABLE caretaker_has_charge CASCADE;
DROP TABLE caretaker_salaried_by CASCADE;
DROP TABLE full_time_takes_leave CASCADE;
DROP TABLE pet_category CASCADE;
DROP TABLE pet_owner CASCADE;
DROP TABLE pet_owner_bids_for CASCADE;
DROP TABLE pets_own_by CASCADE;
DROP TABLE pets_taken_care_by CASCADE;


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
    category_name VARCHAR PRIMARY KEY,
    basic_charge NUMERIC NOT NULL
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
	PRIMARY KEY (caretaker_email, start_date, end_date),
    CHECK(start_date <= end_date)
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
    pet_name        VARCHAR REFERENCES pets_own_by(pet_name),
    startdate       DATE UNIQUE NOT NULL,
    enddate         DATE UNIQUE NOT NULL,
    amount          NUMERIC NOT NULL,
	status			INTEGER DEFAULT 0 NOT NULL,
    PRIMARY KEY (pet_owner_email, caretaker_email, pet_name, startdate, enddate),
    CHECK(startdate <= enddate)
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
	PRIMARY KEY(caretaker_email, start_date),
    CHECK(start_date <= end_date)
);

CREATE TABLE caretaker_salaried_by(
	caretaker_email  VARCHAR REFERENCES caretaker(email), 
	admin_email VARCHAR REFERENCES admin(email),
	amount NUMERIC NOT NULL,
	year INTEGER NOT NULL,
	month INTEGER NOT NULL,
	PRIMARY KEY(caretaker_email, year, month)
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

CREATE OR REPLACE FUNCTION
caretaker_availability() RETURNS TRIGGER AS
$$ DECLARE ct NUMERIC;
    BEGIN 
        SELECT COUNT(*) INTO ct FROM caretaker C
        WHERE NEW.caretaker_email = C.email AND C.type = 'full_time';
        IF ct > 0 AND NEW.end_date - NEW.start_date < 150 THEN 
            RETURN NULL;
        ELSE 
            RETURN NEW;  
        END IF;
        END; $$
LANGUAGE plpgsql;

CREATE TRIGGER
check_fulltime_availability
BEFORE INSERT OR UPDATE ON caretaker_has_availability
FOR EACH ROW EXECUTE PROCEDURE caretaker_availability();

CREATE OR REPLACE PROCEDURE caretaker_charge(input_email VARCHAR, input_category VARCHAR, input_charge NUMERIC) as
$$ DECLARE 
  caretaker_type VARCHAR;
  amount NUMERIC;
  begin
    SELECT type FROM caretaker INTO caretaker_type WHERE email = input_email;
    SELECT basic_charge FROM pet_category INTO amount WHERE category_name = input_category;
  IF caretaker_type = 'part_time' THEN
    INSERT INTO caretaker_has_charge VALUES (input_email, input_category, input_charge);
  ELSE 
    INSERT INTO caretaker_has_charge VALUES (input_email, input_category, amount);
  END IF;
END; $$
language plpgsql; 

    CREATE OR REPLACE FUNCTION
    being_taken_care() RETURNS TRIGGER AS
    $$ DECLARE ct NUMERIC;
        BEGIN 
            SELECT COUNT(*) INTO ct FROM pets_taken_care_by ptcb
            WHERE NEW.pet_owner_email = ptcb.pet_owner_email AND NEW.pet_name = ptcb.pet_name
            AND NEW.startdate >= ptcb.start_date AND NEW.enddate <= ptcb.end_date;
            IF ct > 0 THEN 
                RETURN NULL;
            ELSE 
                RETURN NEW;  
            END IF;
            END; $$
    LANGUAGE plpgsql;

CREATE TRIGGER
check_being_taken_care
BEFORE INSERT OR UPDATE ON pet_owner_bids_for
FOR EACH ROW EXECUTE PROCEDURE being_taken_care();