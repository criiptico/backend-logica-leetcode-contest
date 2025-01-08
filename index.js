import express from "express";
import { createClient } from "@supabase/supabase-js";
import bodyParser from "body-parser";
import { configDotenv } from "dotenv";

// Used for local testing
import cors from "cors";

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

app.get("/", (req, res) => {
  res.send("Welcome to the LOGICA Leetcode Contest Backend API");
});

app.get("/problems", async (req, res) => {
  const { data, error } = await supabase.from("problem").select();
  if (error) {
    console.log(error.message);
    // res.send(error.message);
    res.send("");
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
      res.send({ Error: error.message });
    } else {
      res.send("Success");
    }
  } else {
    res.send({
      Error: "Body must contain all key-value pairs.",
    });
  }
});

app.delete("/problem", async (req, res) => {
  const { problem_id: problem_id } = req.body;

  if (problem_id != null) {
    const { data, error } = await supabase
      .from("problem")
      .delete()
      .eq("problem_id", problem_id);

    if (error) {
      console.log(error.message);
      res.send({ Error: error.message });
    } else {
      res.send({ Result: "Success" });
    }
  } else {
    res.send({
      Error: "Body must contain all key-value pairs.",
    });
  }
});

async function register(name, email, password) {
  const { data, error } = await supabase.from("participant").insert([
    {
      participant_name: name,
      participant_email: email,
      password: password,
    },
  ]);

  if (error) {
    throw new Error(error.message);
  }
}

// going to introduce hashing,
//  currently inserts hard coded details
app.get("/register", async (req, res) => {
  let name = "Evan";
  let email = "evantheterrible@uic.edu";
  let password = "hashing next";

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
      .select("participant_id, participant_name, participant_email");

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "An unexpected error occurred" });
  }
});

// Used for local testing
// app.get("/peek_dotenv", (req, res) => {
//   console.log(
//     `Project URL: ${process.env.SB_PROJECT_URL}\nAnon Public Key: ${process.env.SB_ANON_PUBLIC_KEY}`
//   );
//   res.send(
//     `Project URL: ${process.env.SB_PROJECT_URL}\nAnon Public Key: ${process.env.SB_ANON_PUBLIC_KEY}`
//   );
// });

app.listen(port, () => {
  console.log(`App is listening on port ${port}`);
});
