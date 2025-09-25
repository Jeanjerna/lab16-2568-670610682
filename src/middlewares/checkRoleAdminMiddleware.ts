// src/middlewares/checkRoleAdminMiddleware.ts
import { type Request, type Response, type NextFunction } from "express";
import { type CustomRequest, type User } from "../libs/types.js";
import { users } from "../db/db.js";

// interface CustomRequest extends Request {
//   user?: any; // Define the user property
//   token?: string; // Define the token property
// }

export const checkRoleAdmin = (
  req: CustomRequest,
  res: Response,
  next: NextFunction
) => {
  // 1. get "user payload" and "token" from (custom) request
  const payload = req.user;
  const token = req.token;

  // 2. check if user exists (search with username) and role is ADMIN
  const user = users.find((u: User) => u.username === payload?.username);
  if (!user || user.role !== "ADMIN") {
    return res.status(401).json({
      success: false,
      message: "Unauthorized user",
    });
  }

  // (optional) check if token exists in user data

  // Proceed to next middleware or route handler
  next();
};