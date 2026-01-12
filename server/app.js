/**
 * Project Name: SocialEcho
 * Description: A social networking platform with automated content moderation and context-based authentication system.
 *
 * Author: Neaz Mahmud
 * Email: neaz6160@gmail.com
 * Date: 19th June 2023
 */

const path = require("path");

// Load env file
const dotenvResult = require("dotenv").config({
  path: path.join(__dirname, ".env"),
});
if (dotenvResult.error) {
  console.warn(
    "⚠️  Warning: .env file not found or could not be loaded. Make sure .env exists in the server/ folder."
  );
}

const express = require("express");
const passport = require("passport");
require("./config/passport.js"); // Passport config

const cors = require("cors");
const morgan = require("morgan");

const adminRoutes = require("./routes/admin.route");
const userRoutes = require("./routes/user.route");
const postRoutes = require("./routes/post.route");
const communityRoutes = require("./routes/community.route");
const contextAuthRoutes = require("./routes/context-auth.route");
const search = require("./controllers/search.controller");
const Database = require("./config/database");
const decodeToken = require("./middlewares/auth/decodeToken");

const app = express();
const PORT = process.env.PORT || 4000;

// Connect database
const db = new Database(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

db.connect().catch((err) =>
  console.error("Error connecting to database:", err)
);

// Middleware
app.use(
  cors({
    origin: ["https://social-echoo.vercel.app", "http://localhost:3000"],
    credentials: true,
  })
);

app.use(morgan("dev"));
app.use("/assets/userFiles", express.static(__dirname + "/assets/userFiles"));
app.use(
  "/assets/userAvatars",
  express.static(__dirname + "/assets/userAvatars")
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(passport.initialize());

// Debug: log JWT secrets
console.log("Loaded SECRET:", process.env.SECRET ? "✅" : "❌ MISSING");
console.log(
  "Loaded REFRESH_SECRET:",
  process.env.REFRESH_SECRET ? "✅" : "❌ MISSING"
);

// Routes
app.get("/server-status", (req, res) => {
  res.status(200).json({ message: "Server is up and running!" });
});

app.get("/search", decodeToken, search);

app.use("/auth", contextAuthRoutes);
app.use("/users", userRoutes);
app.use("/posts", postRoutes);
app.use("/communities", communityRoutes);
app.use("/admin", adminRoutes);

// Graceful shutdown
process.on("SIGINT", async () => {
  try {
    await db.disconnect();
    console.log("Disconnected from database.");
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
});

// Start server
app.listen(PORT, () => console.log(`Server up and running on port ${PORT}!`));
