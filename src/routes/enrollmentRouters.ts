import { Router, type Request, type Response } from "express";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
dotenv.config();

import type {
  User,
  CustomRequest,
  UserPayload,
  Student,
  Enrollment,
} from "../libs/types.js";

// import database
import {
  users,
  reset_users,
  enrollments,
  reset_enrollments,
  students,
} from "../db/db.js";
import { zStudentId, zEnrollmentBody } from "../libs/zodValidators.js";

import { authenticateToken } from "../middlewares/authenMiddleware.js";
import { checkRoleAdmin } from "../middlewares/checkRoleAdminMiddleware.js";
import { checkALLRole } from "../middlewares/checkALLRoleMiddleware.js";
import { en, tr } from "zod/locales";

const router = Router();

router.get(
  "/",
  authenticateToken,
  checkRoleAdmin,
  (req: CustomRequest, res: Response) => {
    try {
      return res.json({
        success: true,
        data: enrollments,
      });
    } catch (err) {
      return res.status(200).json({
        success: false,
        message: "Something is wrong, please try again",
        error: err,
      });
    }
  }
);

router.post(
  "/reset",
  authenticateToken,
  checkRoleAdmin,
  (req: CustomRequest, res: Response) => {
    try {
      reset_enrollments();
      return res.status(200).json({
        success: true,
        message: "enrollment database has been reset",
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: "Something is wrong, please try again",
        error: err,
      });
    }
  }
);

router.get(
  "/:studentId",
  authenticateToken,
  checkALLRole,
  (req: CustomRequest, res: Response) => {
    try {
      const studentId = req.params.studentId;
      const result = zStudentId.safeParse(studentId);

      if (!result.success) {
        return res.status(400).json({
          message: "Validation failed",
          errors: result.error.issues[0]?.message,
        });
      }

      const foundIndex = students.findIndex(
        (std: Student) => std.studentId === studentId
      );

      if (foundIndex === -1) {
        return res.status(404).json({
          success: false,
          message: "Student does not exists",
        });
      }

      if (req.user?.role === "ADMIN") {
        return res.status(200).json({
          success: true,
          message: "Student Information",
          data: students[foundIndex],
        });
      } else if (req.user?.role === "STUDENT") {
        if (req.user.studentId === studentId) {
          return res.status(200).json({
            success: true,
            message: "Student Information",
            data: students[foundIndex],
          });
        } else {
          return res.status(403).json({
            success: false,
            message: "Forbidden access",
          });
        }
      }
    } catch (err) {
      return res.status(200).json({
        success: false,
        message: "Something is wrong, please try again",
        error: err,
      });
    }
  }
);

router.post(
  "/:studentId",
  authenticateToken,
  checkALLRole,
  (req: CustomRequest, res: Response) => {
    try {
      const studentId = req.params.studentId;

      if (req.user?.studentId !== studentId || req.user?.role === "ADMIN") {
        return res.status(403).json({
          success: false,
          message: "Forbidden access",
        });
      }

      const body = req.body as Enrollment;
      const result = zEnrollmentBody.safeParse(body);

      if (!result.success) {
        return res.status(400).json({
          message: "Validation failed",
          errors: result.error.issues[0]?.message,
        });
      }

      const foundIndex_enrollment = enrollments.findIndex(
        (std: Enrollment) =>
          std.studentId === studentId && std.courseId === body.courseId
      );

      if (foundIndex_enrollment !== -1) {
        return res.status(400).json({
          success: false,
          message: "studentId && courseId is already exists",
        });
      }

      const new_enrollment = body;
      enrollments.push(new_enrollment);

      const foundIndex_student = students.findIndex(
        (std: Student) => std.studentId === studentId
      );

      students[foundIndex_student]?.courses?.push(body.courseId);

      return res.status(200).json({
        success: true,
        message: `Student ${studentId} && course ${body.courseId} has been added successfully`,
        data: new_enrollment,
      });
    } catch (err) {
      return res.status(200).json({
        success: false,
        message: "Something is wrong, please try again",
        error: err,
      });
    }
  }
);

router.delete(
  "/:studenId",
  authenticateToken,
  checkALLRole,
  (req: CustomRequest, res: Response) => {
    try {
      const body = req.body;
      const studentId = req.params.studenId;
      const parseResult = zStudentId.safeParse(studentId);
      if (!parseResult.success) {
        return res.status(400).json({
          message: "Validation failed",
          errors: parseResult.error.issues[0]?.message,
        });
      }

      if (req.user?.role === "ADMIN" || req.user?.studentId !== studentId) {
        return res.status(403).json({
          success: false,
          message: "You are not allowed to modify another student's data",
        });
      }

      const foundIndex_enrollment = enrollments.findIndex(
        (e: Enrollment) =>
          e.studentId === studentId && e.courseId === body.courseId
      );
      if (foundIndex_enrollment === -1) {
        return res.status(404).json({
          success: false,
          message: "Enrollment does not exists",
        });
      }

      enrollments.splice(foundIndex_enrollment, 1);

      const foundIndex_student = students.findIndex(
        (s: Student) => s.studentId === studentId
      );
      if (foundIndex_student === -1) {
        return res.status(404).json({
          success: false,
          message: "Student does not exists",
        });
      }
      const foundIndex3 =
        students[foundIndex_student]?.courses?.findIndex(
          (c: string) => c === body.courseId
        ) || -1;
      if (foundIndex3 === -1) {
        return res.status(404).json({
          success: false,
          message: "Course does not exists",
        });
      }

      students[foundIndex_student]?.courses?.splice(foundIndex3, 1);

      return res.status(200).json({
        success: true,
        message: `Student ${studentId} && Course ${body.courseId} has been deleted successfully`,
        data: enrollments,
      });
    } catch (err) {
      return res.status(200).json({
        success: false,
        message: "Something is wrong, please try again",
        error: err,
      });
    }
  }
);

export default router;
