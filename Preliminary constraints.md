# **Preliminary Constraints**

**User**

- Each user should only have a single password and NOT NULL

- Password must be hashed (Argon2)

- User name is NOT NULL

- Email is used as username and must be unique

- Pet owner and caretaker can share the same user account(with overlap)

- User can only be pet owner and caretaker (with covering)

  

**Pet owner**

- Each Pet owner must be uniquely identified by their email address

- Pet owner must own at least one pet

  

**Caretaker (full time)**

- Max 5 pets at a time
- Should not take care of pets that they cannot take care of
- Must work for a minimum of 2x150 consecutive days
- Cannot apply leave when there is at least one pet under their care 



**Caretaker (part time)**

- Max 2 pets at a time (for low rating)

- Max 5 pets at a time (for good rating)

- Should not take care of pets that they cannot take care of

  

**Pet**

- A pet can only be taken care of by one care taker at a time.

- A pet can only be owned by one pet owner

- A pet is unique identified by pet ID

- Pet name is NOT NULL

  

**PCS Admin**

- Each admin should only has a single password and not null

- Each admin is identified by a unique Admin ID

  

**Charge**

- Charge amount cannot be negative integer or null

  

**Bidsfor**

- Bidding price cannot be negative integer or null

- Subsequent bidding amounts must be higher than the previous one by a minimum fixed integer amount.

  

**TakenCareBy**

- Start date must be before end date

- There are 2 transfers for each transaction 

- There are only 3 transferring method

- Pet owner deliver 

- Caretaker pick up

- Transfer through the physical building of PCS

  

**Rate**

- Rating can be from 1-5 stars (integer) and optional

- Rating comment can be optional (NULL)

  

**Leave**

- Start date must be before end date



**PetCategory**

- Pet category is uniquely identified by CategoryID

