import express from "express";
import { createClient } from "@supabase/supabase-js";
import speakeasy from "speakeasy";
import nodemailer from "nodemailer";
import cron from "node-cron";
import bodyParser from "body-parser";
import { configDotenv } from "dotenv";

// Used for local testing
import cors from "cors";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import cookieParser from "cookie-parser";

configDotenv({ path: ".env" });

const app = express();
const port = 3000;

app.use(cookieParser());

// Used for local testing
app.use(
  cors({
    origin: "http://127.0.0.1:5500", // Frontend domain
    credentials: true, // Allows sending cookies
  })
);

// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded());

// parse application/json
app.use(bodyParser.json());

const supabase = createClient(
  process.env.SB_PROJECT_URL,
  process.env.SB_ANON_PUBLIC_KEY
);

app.get("/", (req, res) => {
  res.send("Welcome to the LOGICA Leetcode Contest Backend API");
});

app.get("/:contestID/contest-state", async (req, res) => {
  const { contestID } = req.params;

  const { data, error } = await supabase
    .from("contest")
    .select("contest_id, contest_state")
    .eq("contest_id", contestID);

  if (error) {
    res.send("An unexpected error has occured");
  } else {
    res.json(data);
  }
});

app.put("/contest", async (req, res) => {
  // Set up the timestamp type (start & end) in this way 'YYYY-MM-DD HH:MI:SS' HH is 24-hr
  const { contest_name, semester, year, contest_state, start, end } = req.body;

  if (!contest_name || !semester || !year || !contest_state || !start || !end) {
    res.send({ error: "Must include all key value pairs." });
  }

  const { data, error } = await supabase.from("contest").insert([
    {
      contest_name: contest_name,
      semester: semester,
      year: year,
      contest_state: contest_state,
      start: start,
      end: end,
    },
  ]);

  if (error) {
    res.json({ error: "An error occured", message: error });
  } else {
    res.json({ message: "Successfully created a contest." });
  }
});

app.get("/contest", async (req, res) => {
  const { data, error } = await supabase.from("contest").select();

  if (error) {
    res.send({ error: "An error occured", message: error });
  } else {
    res.json(data);
  }
});

app.get("/contest/:contestID", async (req, res) => {
  const { contestID } = req.params;

  const { data, error } = await supabase
    .from("contest")
    .select()
    .eq("contest_id", contestID);

  if (error) {
    res.send({ error: "An error occured", message: error });
  } else {
    res.json(data);
  }
});

app.get("/problems", async (req, res) => {
  const { data, error } = await supabase.from("problem").select();
  if (error) {
    console.log(error.message);
    res.send({ error: "An error has occured" });
  } else {
    res.send(data);
  }
});

app.put("/problem", async (req, res) => {
  // Payload must contain all of the key-value pairs to add a problem to the database
  const {
    problem_name: problem_name,
    difficulty: difficulty,
    url: url,
  } = req.body;

  if (problem_name != null && difficulty != null && url != null) {
    // Note: Must check if this problem exists in the database already or not.
    const { data, error } = await supabase.from("problem").insert([
      {
        problem_name: problem_name,
        difficulty: difficulty,
        url: url,
      },
    ]);

    if (error) {
      console.log(error.message);
      res.send({
        Error: "An error has occured, please check the console log.",
      });
    } else {
      res.send("Success");
    }
  } else {
    res.status(400).send({
      error: "Body must contain all key-value pairs.",
    });
  }
});

app.delete("/problem/:id", async (req, res) => {
  // const { problem_id: problem_id } = req.body;
  const { id: problem_id } = req.params;

  try {
    if (problem_id != null) {
      const { data, error } = await supabase
        .from("problem")
        .delete()
        .eq("problem_id", problem_id);

      if (error) {
        console.log(error.message);
        res.status(500).send({
          Error: "An error has occured, please check the console log.",
        });
      } else {
        res.send({ Result: "Success" });
      }
    } else {
      res.status(400).send({
        error: "Body must contain all key-value pairs.",
      });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "An unexpected error occurred" });
  }
});

// User & Password Management
// ----
async function register(name, email, password) {
  const saltRounds = 10;
  const hashedPassword = await bcrypt.hash(password, saltRounds);

  const { data, error } = await supabase.from("participant").insert([
    {
      participant_name: name,
      participant_email: email,
      password: hashedPassword,
    },
  ]);

  if (error) {
    throw new Error(error.message);
  }
}

app.post("/register", async (req, res) => {
  const { firstName, lastName, email, password } = req.body;

  // first check if already registered
  try {
    const { data, error } = await supabase
      .from("participant")
      .select("participant_id, participant_name, participant_email, password")
      .eq("participant_email", email);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    if (data && data.length > 0) {
      res.json({ message: "Participant exists", participant: data });
    } else {
      // register after checking in db
      let name = firstName + " " + lastName;
      await register(name, email, password);
      res.json(`Registered ${name} with username -> ${email}`);
    }
  } catch (err) {
    res.status(500).json({ error: "An unexpected error occurred" });
  }
});

// for development to see all users
app.get("/users", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("participant")
      .select(
        "participant_id, participant_name, participant_email, password, session_token"
      );

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "An unexpected error occurred" });
  }
});

// basic route to delete user, for testing,
// let me know if we will need this for future reference
// for now hardcoded until connected to frontend
app.get("/delete-user", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("participant")
      .delete()
      .eq("participant_email", "itorr4@uic.edu");

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "An unexpected error occurred" });
  }
});

// Middleware to check if the user is authenticated
const protectRoute = async (req, res, next) => {
  const token = req.cookies.authToken; // Get the token from the cookie
  console.log("In protectedRoutes middleware");

  if (!token) {
    return res.status(401).json({ error: "Authentication token missing" });
  }

  try {
    // Verify the token
    const decoded = jwt.verify(token, process.env.JWT_KEY);

    // Attach user info to the request object for further use
    req.user = decoded;
    next(); // Allow the request to proceed to the protected route
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
};

// Protected route to get leaderboard or user-related data
app.get("/protected", protectRoute, async (req, res) => {
  try {
    // Now you can access req.user which contains the decoded JWT payload
    const { email, name } = req.user;
    const { data, error } = await supabase
      .from("participant")
      .select("participant_id, participant_name, participant_email")
      .eq("participant_email", email);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    console.log("Proected content successful");
    res.json({
      message: "Protected content, user has logged in successfully",
      user: data,
    });
  } catch (err) {
    res.status(500).json({ error: "An unexpected error occurred" });
  }
});

async function setUserSession(token, email) {
  try {
    // how can data be used?
    const { data, error } = await supabase
      .from("participant")
      .update({ session_token: token })
      .eq("participant_email", email);

    if (error) {
      throw new Error("Failed to update session token");
    }
  } catch (err) {
    console.error("Error in setUserSession:", err.message);
  }
}

app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    // Fetch user by email
    const { data, error } = await supabase
      .from("participant")
      .select("participant_name, participant_email, password")
      .eq("participant_email", email);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    // Check if user exists
    if (!data || data.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    // user entry
    const user = data[0];

    // Compare the provided password with the stored hashed password
    const isPasswordCorrect = await bcrypt.compare(password, user.password);

    if (!isPasswordCorrect) {
      return res.status(401).json({ error: "Invalid password" });
    }

    // Generate JWT token
    const token = jwt.sign(
      { email: user.participant_email, name: user.participant_name },
      process.env.JWT_KEY, // Ensure you define JWT_SECRET in your .env file
      { expiresIn: "5m" } // Token validity period
    );

    // update user session token
    setUserSession(token, email);

    // Set JWT as HTTP-only cookie
    // how can it be saved to a domain? for persitant cookies?
    res.cookie("authToken", token, {
      httpOnly: true, // Prevents JavaScript access to cookies
      maxAge: 60 * 5000, // 5 minute
      path: "/login.html",
      secure: false,
      sameSite: "Strict",
      domain: "127.0.0.1",
    });

    // Send the success response after setting the cookie
    return res.json({ message: `Welcome back, ${user.participant_name}!` });
  } catch (err) {
    return res.status(500).json({ error: "An unexpected error occurred" });
  }
});

function generateOTP() {
  // Generates a unique token every 30 seconds
  const otp = speakeasy.totp({
    secret: process.env.OTP_SECRET,
    encoding: "base32",
  });
  return otp;
}

async function sendOTPEmail(email, otp) {
  let transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.LOGICA_DEV_EMAIL,
      pass: process.env.LOGICA_DEV_APP_PASSWORD,
    },
  });

  let info = await transporter.sendMail({
    from: `"LOGICA Development" ${process.env.LOGICA_DEV_EMAIL}`,
    to: email,
    subject: "Your OTP Code For LOGICA Leetcode Contest",
    text: `Your OTP Code is: ${otp}\n\nClick this link to be redirected to the sign in page: https://google.com`, // This is a placeholder, must replace later
  });

  console.log(`Message sent: ${info.messageId}`);
}

app.post("/forgot-password/:role", async (req, res) => {
  const { email } = req.body;
  const { role: role } = req.params;

  if (!email) {
    res.status(400).send({ error: "Email is required" });
  }
  if (role == "organizer" || role == "participant") {
    const otp = generateOTP();
    try {
      const saltRounds = 10;
      const hashed_otp = await bcrypt.hash(otp, saltRounds);

      const { data, error } = await supabase
        .from(`${role}`)
        .update([{ one_time_password: hashed_otp }])
        .eq("participant_email", email);

      if (error) {
        res.status(500).send({
          error: "Failed to set OTP to the database",
          message: error.message,
        });
      }
      await sendOTPEmail(email, otp);
      res.status(200).send({ message: "success" });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "An unexpected error occurred" });
    }
  } else {
    res
      .status(400)
      .send({ error: "Appropriate role is required", message: `${role}` });
  }
});

async function reset_password(email, password) {
  const saltRounds = 10;
  const hashedPassword = await bcrypt.hash(password, saltRounds);

  try {
    const { pass_data, pass_error } = await supabase
      .from("participant")
      .update([
        {
          password: hashedPassword,
        },
      ])
      .eq("participant_email", email);

    const { otp_data, otp_error } = await supabase
      .from("participant")
      .update([
        {
          one_time_password: null,
        },
      ])
      .eq("participant_email", email);
    if (pass_error) {
      throw new Error(pass_error.message);
    }
    if (otp_error) {
      throw new Error(otp_error.message);
    }
  } catch (error) {
    throw new Error(error.message);
  }
}

app.get("/change-password", async (req, res) => {
  const { email, new_password, one_time_password } = req.body;

  try {
    // Fetch user by email
    const { data, error } = await supabase
      .from("participant")
      .select("participant_name, participant_email, one_time_password")
      .eq("participant_email", email);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    // Check if user exists
    if (!data || data.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    // user entry
    const user = data[0];

    // Checking if one_time_password has been set or not
    if (user.one_time_password) {
      // Check if the otp is correct
      const isCorrectOTP = await bcrypt.compare(
        one_time_password,
        user.one_time_password
      );
      if (!isCorrectOTP) {
        return res
          .status(401)
          .json({ error: "Invalid email or one time password" });
      } else {
        // If otp is correct, then set the password column to the new password
        await reset_password(email, new_password);
        res.json({ message: "Email reset successfully" });
      }
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "An unexpected error occurred" });
  }
});

app.listen(port, () => {
  console.log(`App is listening on port ${port}\n http://localhost:${port}/`);
});

// startContest should make a request to the database to change the state of the current contest
const startContest = async () => {
  const contest_id = "70359776-26b3-4ecf-9937-ca7cc7d4245e"; // Need to change this in the endContest function too
  console.log("Contest started.");
  const { data, error } = await supabase
    .from("contest")
    .update([{ contest_state: true }])
    .eq("contest_id", contest_id);

  if (error) {
    res.send("An unexpected error has occured");
  } else {
    res.send(`Contest ${contest_id} has been successfully set to true.`);
  }
};

// endContest should make a request to the database to change the state of the current contest
const endContest = async () => {
  const contest_id = "70359776-26b3-4ecf-9937-ca7cc7d4245e"; // Need to change this in the startContest function too
  const { data, error } = await supabase
    .from("contest")
    .update([{ contest_state: false }])
    .eq("contest_id", contest_id);

  if (error) {
    res.send("An unexpected error has occured");
  } else {
    res.send(`Contest ${contest_id} has been successfully set to false.`);
  }
};

// Would require backend reset.
// * * * * * => * (minute) * (hour in 24hrs [0:00 midnight]) * (day of the month) * (month) * (day of the week)
// cron.schedule("42 21 * * 5", startContest);
// cron.schedule("44 21 * * 5", endContest);
// https://crontab.cronhub.io/
