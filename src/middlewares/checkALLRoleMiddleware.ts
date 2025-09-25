// src/middlewares/checkRoleAdminMiddleware.ts
import { type Request, type Response, type NextFunction } from "express";
import { type CustomRequest, type User } from "../libs/types.js";
import { users } from "../db/db.js";

export const checkALLRole = (
  req: CustomRequest,
  res: Response,
  next: NextFunction
) => {

  const payload = req.user;
  const token = req.token;

  const user = users.find((u: User) => u.username === payload?.username);
  if (!user) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized user",
    });
  }

  next();
};