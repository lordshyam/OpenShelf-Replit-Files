import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { insertUserSchema, verifyEmailSchema, User as SelectUser } from "@shared/schema";
import { sendVerificationEmail, generateVerificationCode } from "./email";

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

export function setupAuth(app: Express) {
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET!,
    resave: true,
    saveUninitialized: true,
    store: storage.sessionStore,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      maxAge: 1000 * 60 * 60 * 24 * 7, // 1 week
      httpOnly: true,
      sameSite: 'lax',
    }
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy({
      usernameField: 'email',
      passwordField: 'password'
    }, async (email, password, done) => {
      try {
        // Get user by email
        const user = await storage.getUserByEmail(email);

        if (!user) {
          return done(null, false, { message: "Invalid credentials" });
        }

        if (!(await comparePasswords(password, user.password))) {
          return done(null, false, { message: "Invalid credentials" });
        }

        // Check if user is verified
        if (!user.verified) {
          return done(null, false, { 
            message: "Email not verified. Please verify your email to log in.",
            email: user.email,
            needsVerification: true
          });
        }

        return done(null, user);
      } catch (err) {
        return done(err);
      }
    }),
  );

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);
      if (!user) {
        return done(null, false);
      }
      done(null, user);
    } catch (err) {
      done(err);
    }
  });

  app.post("/api/login", (req, res, next) => {
    passport.authenticate("local", (err: any, user: any, info: any) => {
      if (err) return next(err);
      if (!user) {
        // If the user is not verified, return different response
        if (info && info.needsVerification) {
          return res.status(401).json({ 
            message: info.message,
            email: info.email,
            needsVerification: true
          });
        }
        return res.status(401).json({ message: info?.message || "Invalid credentials" });
      }

      // Set session cookie based on rememberMe flag
      if (req.body.rememberMe) {
        req.session.cookie.maxAge = 1000 * 60 * 60 * 24 * 30; // 30 days
      } else {
        req.session.cookie.expires = undefined; // Session cookie (expires when browser closes)
      }

      req.login(user, (err) => {
        if (err) return next(err);
        res.status(200).json(user);
      });
    })(req, res, next);
  });

  app.post("/api/register", async (req, res, next) => {
    try {
      const result = insertUserSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json(result.error);
      }

      const { username, email } = result.data;

      // Check for existing username or email
      const existingUser = await storage.getUserByUsername(username);
      const existingEmail = await storage.getUserByEmail(email);

      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }
      if (existingEmail) {
        return res.status(400).json({ message: "Email already registered" });
      }

      // Generate a verification code
      const verificationCode = generateVerificationCode();

      // Create the user with verification code and verified = false
      const user = await storage.createUser({
        ...result.data,
        password: await hashPassword(result.data.password),
        verificationCode,
        verified: false
      });

      try {
        // Send verification email
        await sendVerificationEmail(email, verificationCode);
        res.status(201).json({ 
          message: "Registration successful. Please check your email for verification code.",
          email
        });
      } catch (emailError) {
        console.error("Error sending verification email:", emailError);
        // Delete the user if email sending fails
        await storage.deleteUser(user.id);
        return res.status(500).json({ message: "Failed to send verification email. Please try again." });
      }
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/verify-email", async (req, res) => {
    const result = verifyEmailSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json(result.error);
    }

    const { email, code } = result.data;
    const user = await storage.getUserByEmail(email);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.verified) {
      return res.status(400).json({ message: "Email already verified" });
    }

    if (user.verificationCode !== code) {
      return res.status(400).json({ message: "Invalid verification code" });
    }

    await storage.updateUser(user.id, { verified: true, verificationCode: null });

    // Automatically log in the user after verification
    req.login(user, (err) => {
      if (err) {
        return res.status(500).json({ message: "Error logging in after verification" });
      }
      res.json({ message: "Email verified successfully" });
    });
  });


  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });

  app.get("/api/user", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    // Get fresh user data to ensure we have the latest community info
    const user = await storage.getUser(req.user!.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    
    return res.json(user);
  });
}