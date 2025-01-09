import express from "express";
import { createClient } from "@supabase/supabase-js";
import speakeasy from "speakeasy";
import nodemailer from "nodemailer";
import bodyParser from "body-parser";
import { configDotenv } from "dotenv";

// Used for local testing
import cors from "cors";
import bcrypt from "bcrypt";

configDotenv({ path: ".env" });

const app = express();
const port = 3000;

// Used for local testing
app.use(cors());

// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded());

// parse application/json
app.use(bodyParser.json());

const supabase = createClient(
  process.env.SB_PROJECT_URL,
  process.env.SB_ANON_PUBLIC_KEY
);

function generateOTP() {
  // Generates a unique token every 30 seconds
  const otp = speakeasy.totp({
    secret: process.env.OTP_SECRET,
    encoding: "base32",
  });
  return otp;
}

app.get("/logica-leetcode/v1/", (req, res) => {
  res.send("Welcome to the LOGICA Leetcode Contest Backend API");
});

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
    text: `Your OTP Code is: ${otp}\n\nClick this link to be redirected to the sign in page: https://google.com`,
  });

  console.log(`Message sent: ${info.messageId}`);
}

app.post("/logica-leetcode/v1/generate-otp/:role", async (req, res) => {
  const { email } = req.body;
  const { role: role } = req.params;

  if (!email) {
    res.status(400).send({ error: "Email is required" });
  }
  if (role != "organizer" || role != "participant") {
    res.status(400).send({ error: "Appropriate role is required" });
  }

  const otp = generateOTP();
  try {
    await sendOTPEmail(email, otp);

    const { data, error } = await supabase
      .from(`${role}`)
      .update([{ one_time_password: otp }])
      .eq("email", email);

    if (error) {
      res.status(500).send({
        error: "Failed to set OTP to the database",
        message: error.message,
      });
    }
    res.status(200).json({ message: "success" });
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to send OTP email", message: error.message });
  }
});

app.get("/logica-leetcode/v1/problems", async (req, res) => {
  const { data, error } = await supabase.from("problem").select();
  if (error) {
    console.log(error.message);
    res.send({ error: "An error has occured, please check the console log." });
  } else {
    res.send(data);
  }
});

app.put("/logica-leetcode/v1/problem", async (req, res) => {
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
    res.send({
      Error: "Body must contain all key-value pairs.",
    });
  }
});

app.delete("/logica-leetcode/v1/problem/:id", async (req, res) => {
  // const { problem_id: problem_id } = req.body;
  const { id: problem_id } = req.params;

  if (problem_id != null) {
    const { data, error } = await supabase
      .from("problem")
      .delete()
      .eq("problem_id", problem_id);

    if (error) {
      console.log(error.message);
      res.send({
        Error: "An error has occured, please check the console log.",
      });
    } else {
      res.send({ Result: "Success" });
    }
  } else {
    res.send({
      Error: "Body must contain all key-value pairs.",
    });
  }
});

// NEEDS TESTING
// app.get("/logica-leetcode/v1/contest/problems", async (req, res) => {
//   const { semester: semester, year: year } = req.query;

//   if (semester != null || year != null) {
//     // Needs testing. Expected to return all problems of a contest_id, where they are all from a certain semester and year
//     const { data, error } = await supabase
//       .from("contest")
//       .select(
//         `
//         *,
//         contest_problem (
//         contest_id,
//         problem_id,
//           problem(
//             problem_id,
//             problem_name,
//             difficulty,
//             url
//           )
//         )`
//       )
//       .eq(`contest.semester`, semester)
//       .eq(`contest.year`, year);

//     if (error) {
//       console.log(error.message);
//       res.send({
//         Error: "An error has occured, please check the console log.",
//       });
//     } else {
//       res.send(data);
//     }
//   } else {
//     res.send({ Error: "Request line must contain all query parameters." });
//   }
// });

// NEEDS TESTING
// app.get("/logica-leetcode/v1/leaderboard", async (req, res) => {
//   const { semester: semester, year: year } = req.query;

//   if (semester != null || year != null) {
//     // Needs testing. Should return all of the group names, participant names, and points for that group given the
//     // contest's semester and year
//     const { data, error } = await supabase
//       .from("contest")
//       .select(
//         `
//       *,
//       group(
//         group_name,
//         participant_names,
//         points
//       )`
//       )
//       .eq(`contest.semester`, semester)
//       .eq(`contest.year`, year);

//     if (error) {
//       console.log(error.message);
//       res.send({
//         Error: "An error has occured, please check the console log.",
//       });
//     } else {
//       res.send(data);
//     }
//   } else {
//     res.send({ Error: "Request line must contain all query parameters." });
//   }
// });

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

// going to introduce hashing,
//  currently inserts hard coded details
app.get("/register", async (req, res) => {
  let name = "Ivan";
  let email = "itorr4@uic.edu";
  let password = "i-am-password";

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
      await register(name, email, password);
      res.json(
        `Registered ${name} with username and password -> ${email}, ${password}`
      );
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
      .select("participant_id, participant_name, participant_email, password");

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
      .eq("participant_email", "evantheterrible@uic.edu");

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "An unexpected error occurred" });
  }
});

app.get("/login", async (req, res) => {
  let email = "itorr4@uic.edu";
  let password = "i-am-password";

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
      return res.status(401).json({ error: "Invalid email or password" });
    }

    // If password is correct, respond with success
    res.json({ message: `Welcome back, ${user.participant_name}!` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "An unexpected error occurred" });
  }
});

// Used for local testing
// app.get("/peek-dotenv", (req, res) => {
//   console.log(
//     `Project URL: ${process.env.SB_PROJECT_URL}\nAnon Public Key: ${process.env.SB_ANON_PUBLIC_KEY}`
//   );
//   res.send(
//     `Project URL: ${process.env.SB_PROJECT_URL}\nAnon Public Key: ${process.env.SB_ANON_PUBLIC_KEY}`
//   );
// });

app.listen(port, () => {
  console.log(
    `App is listening on port ${port}\n http://localhost:3000/logica-leetcode/v1/`
  );
});
