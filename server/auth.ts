import { Express, Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { storage } from "./storage";
import { User as SelectUser } from "@shared/schema";

const JWT_SECRET = process.env.JWT_SECRET || "fallback_secret_change_me";

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}


export function setupAuth(app: Express) {
  // Authentication middleware to populate req.user from JWT cookie
  app.use(async (req, res, next) => {
    const token = req.cookies.accessToken;
    if (!token) {
      return next();
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { id: string };
      const user = await storage.getUser(decoded.id);
      if (user) {
        req.user = user;
      }
      next();
    } catch (err) {
      // Token invalid or expired, just proceed without req.user
      next();
    }
  });

  app.post("/api/register", async (req, res, next) => {
    try {
      const { email, password, firstName, lastName } = req.body;
      if (!email || !password) {
        return res.status(400).send("Email and password are required");
      }

      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).send("User already exists");
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const user = await storage.createUser({
        email,
        password: hashedPassword,
        firstName,
        lastName,
      });

      const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: "7d" });
      res.cookie("accessToken", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      res.status(201).json(user);
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/login", async (req, res, next) => {
    try {
      const { email, password } = req.body;
      const user = await storage.getUserByEmail(email);
      if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.status(401).send("Invalid email or password");
      }

      const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: "7d" });
      res.cookie("accessToken", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      res.status(200).json(user);
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/logout", (req, res) => {
    res.clearCookie("accessToken");
    res.sendStatus(200);
  });

  app.get("/api/user", (req, res) => {
    if (!req.user) return res.sendStatus(401);
    res.json(req.user);
  });
}

export function isAuthenticated(req: Request, res: Response, next: NextFunction) {
  if (req.user) return next();
  res.status(401).send("Unauthorized");
}
